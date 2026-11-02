# 后端设计

## 1. 技术结构

后端使用 NestJS、TypeORM、MySQL 8.0、JWT、Argon2id 和 Socket.IO。模块划分如下：

| 模块 | 职责 |
| --- | --- |
| `auth` | 登录、JWT、当前用户身份验证 |
| `users` | 管理员维护用户和重置密码 |
| `assets` | 资产台账、维修/报废状态 |
| `applications` | 申请、审批、取消、确认借出 |
| `loans` | 当前借用、逾期、历史、归还 |
| `notifications` | 持久化站内通知和管理员待办 |
| `realtime` | 已认证用户的 WebSocket 推送 |

数据库实体与 `database/schema.sql` 一一对应。TypeORM 关闭了 `synchronize`；数据库迁移应显式审阅后执行，不能由服务启动过程自动猜测表结构。

## 2. 身份和授权

所有 API 默认需要 JWT。只有登录和健康检查是公开接口。

JWT 只作为会话载体，不直接信任令牌中的角色。每次请求的 `JwtStrategy` 都会重新查询数据库，并确认用户仍为 `ACTIVE`。角色守卫随后检查：

- `ADMIN`：用户管理、资产写入、审批、交接、归还、所有记录查询。
- `EMPLOYEE`：查看资产、提交和取消自己的待定申请、查看自己的申请和借还记录。

员工详情接口会在查询后再次校验申请/借用归属，防止通过猜测 ID 越权。前端隐藏按钮不构成权限控制。

## 3. 申请流程和事务

```text
PENDING --批准--> APPROVED --实际交接--> CHECKED_OUT --登记归还--> RETURNED
    |--驳回--> REJECTED
    |--员工取消--> CANCELLED
```

核心写操作均在单个 MySQL 事务中完成，固定锁顺序为：

```text
assets -> borrow_applications -> borrow_loans
```

批准申请时：

1. 读取申请的资产 ID。
2. 对资产行执行 `SELECT ... FOR UPDATE`。
3. 对申请行加锁并再次检查 `PENDING`。
4. 检查资产仍为 `AVAILABLE`。
5. 更新申请为 `APPROVED`、资产为 `RESERVED`。
6. 写入审批历史、完成审批待办、创建交接待办。
7. 提交事务并推送持久化通知。

即使并发请求绕过所有服务层检查，数据库的 `active_asset_id` 唯一索引仍会拒绝同一资产的第二笔有效预留。确认借出和归还也使用相同锁顺序，并检查申请、资产和实际借用记录三者状态一致。

## 4. 通知与 WebSocket

通知和待办先写入 MySQL，再尝试 WebSocket 推送。WebSocket 失败不影响业务事务，因此客户端重连后应重新获取：

- `GET /api/notifications?unreadOnly=true`
- `GET /api/todos?status=PENDING&unreadOnly=true`

WebSocket 在 Socket.IO 握手时读取 `auth.token` 或 `Authorization: Bearer ...`，验证 JWT 并查询用户是否启用。认证成功后加入 `user:<id>` 房间。

连接会在 JWT 到期时由服务端主动断开；前端应使用刷新后的有效令牌重连，并重新拉取持久化通知与待办。

服务端事件：

| 事件 | 数据 | 说明 |
| --- | --- | --- |
| `authenticated` | `{ userId }` | 握手认证成功 |
| `notification.created` | 通知实体 | 新通知 |
| `todo.created` | 待办实体 | 新待办 |
| `todos.changed` | `{ applicationId }` | 待办状态变化，客户端应刷新待办列表 |
| `unread.updated` | `{ unreadNotifications, unreadTodos }` | 未读数量刷新 |

当前实现是单实例内存房间广播。若以后部署多个后端实例，应接入 Socket.IO Redis Adapter，数据库持久化机制不需要改变。

管理员可以通过 `POST /api/notifications/send` 手动发送站内通知：

- `sendToAll=true` 时发送给全部启用账号。
- 指定接收人时必须传入启用账号的 `recipientUserIds`。
- 每位接收人保存一条独立通知和未读状态。
- `sender_user_id` 记录发送管理员，供通知列表展示和审计。
- 手动通知使用 `ADMIN_MESSAGE` 类型，不创建业务待办。

## 5. 日期与数据一致性

- 后端把 `Date` 交给 MySQL 驱动并按 UTC 连接。
- API 输入输出使用 ISO 8601 时间。
- 管理员可登记过去的实际借出/归还时间，但不能登记未来时间。
- 实际归还时间不得早于借出时间。
- 申请、审批、交接、归还的业务变化同时写主状态和操作历史。
- 不提供业务表删除接口。

## 6. 主要失败处理

| 场景 | HTTP |
| --- | --- |
| 未登录、令牌失效、账号停用 | `401` |
| 员工访问管理员接口或他人记录 | `403` |
| 资源不存在 | `404` |
| DTO 校验失败 | `400` |
| 重复审批、资产状态冲突、重复归还 | `409` |
| 数据库不可用 | `500` / 健康检查 `503` |

MySQL 唯一键和关联错误由全局异常过滤器转换为通用冲突提示，不向客户端泄露 SQL。
