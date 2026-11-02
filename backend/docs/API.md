# 后端接口设计

## 通用约定

- 基础路径：`/api`
- 请求和响应：JSON，字段使用 camelCase
- 时间：ISO 8601，例如 `2026-11-10T10:00:00.000Z`
- ID：字符串形式，避免前端大整数精度问题
- 认证：除登录和健康检查外，均使用

```http
Authorization: Bearer <accessToken>
```

- 分页参数：`page` 从 1 开始，`pageSize` 为 1-100
- 分页响应：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 1. 认证

### `POST /auth/login`

```json
{
  "username": "zhangsan",
  "password": "your-password"
}
```

响应：

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "user": {
    "id": "2",
    "username": "zhangsan",
    "employeeNo": "EMP002",
    "fullName": "张三",
    "role": "EMPLOYEE"
  }
}
```

### `GET /auth/me`

返回当前用户，同时用于验证令牌。

## 2. 用户管理（管理员）

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `GET` | `/users` | 分页查询；支持 `role`、`status`、`q` |
| `GET` | `/users/:id` | 用户详情 |
| `POST` | `/users` | 创建用户 |
| `PATCH` | `/users/:id` | 修改姓名、工号、角色或状态 |
| `POST` | `/users/:id/reset-password` | 管理员重置密码 |

创建用户：

```json
{
  "username": "lisi",
  "employeeNo": "EMP003",
  "fullName": "李四",
  "role": "EMPLOYEE",
  "password": "temporary-password"
}
```

后端禁止停用当前登录账号，并禁止移除最后一个启用的管理员。

## 3. 资产

| 方法 | 路径 | 权限 | 功能 |
| --- | --- | --- | --- |
| `GET` | `/assets` | 登录用户 | 分页查询；支持 `status`、`category`、`q` |
| `GET` | `/assets/:id` | 登录用户 | 资产详情 |
| `POST` | `/assets` | 管理员 | 创建资产，初始状态固定为 `AVAILABLE` |
| `PATCH` | `/assets/:id` | 管理员 | 修改基础信息和存放位置 |
| `PATCH` | `/assets/:id/status` | 管理员 | 维修、报废或恢复可借 |

资产状态不能由该接口手工设为 `RESERVED` 或 `BORROWED`；这两个状态只由审批和交接事务维护。

状态变更：

```json
{
  "status": "MAINTENANCE"
}
```

允许：

- `AVAILABLE -> MAINTENANCE`
- `MAINTENANCE -> AVAILABLE`
- `AVAILABLE | MAINTENANCE -> RETIRED`

资产有有效预留或未归还借用时，不能设为维修或报废。

## 4. 借用申请

| 方法 | 路径 | 权限 | 功能 |
| --- | --- | --- | --- |
| `GET` | `/applications` | 登录用户 | 管理员查全部，员工只查自己 |
| `GET` | `/applications/:id` | 登录用户 | 申请人或管理员查看 |
| `GET` | `/applications/:id/events` | 登录用户 | 申请人或管理员查看轨迹 |
| `POST` | `/applications` | 员工 | 提交申请 |
| `POST` | `/applications/:id/cancel` | 员工 | 取消自己的待审批申请 |
| `POST` | `/applications/:id/approve` | 管理员 | 批准并预留资产 |
| `POST` | `/applications/:id/reject` | 管理员 | 驳回 |
| `POST` | `/applications/:id/checkout` | 管理员 | 确认实际交接并登记借出 |

提交申请：

```json
{
  "assetId": "1",
  "purpose": "外场客户演示使用",
  "expectedReturnAt": "2026-11-10T10:00:00.000Z"
}
```

批准：

```json
{
  "comment": "批准，请到 A 区完成交接"
}
```

驳回：

```json
{
  "reason": "该时间段资产已经预约"
}
```

确认借出：

```json
{
  "checkedOutAt": "2026-11-02T08:30:00.000Z",
  "handoverNote": "含电源和收纳包"
}
```

`checkedOutAt` 可省略。提交申请仅产生待审批记录，不会预留资产；批准才变更为 `APPROVED + RESERVED`。

## 5. 实际借还

| 方法 | 路径 | 权限 | 功能 |
| --- | --- | --- | --- |
| `GET` | `/loans` | 登录用户 | 管理员查全部，员工只查自己 |
| `GET` | `/loans/:id` | 登录用户 | 借用人和管理员查看 |
| `POST` | `/loans/:id/return` | 管理员 | 登记实际归还 |

`GET /loans` 参数：

- `view=all|active|returned`
- `overdueOnly=true`
- `assetId`
- `applicantId`（仅管理员生效）
- `q`

当前借用：

```http
GET /api/loans?view=active&page=1&pageSize=20
```

逾期列表：

```http
GET /api/loans?view=active&overdueOnly=true&page=1&pageSize=20
```

登记归还：

```json
{
  "returnedAt": "2026-11-09T09:00:00.000Z",
  "returnNote": "设备完好"
}
```

## 6. 通知和待办

| 方法 | 路径 | 权限 | 功能 |
| --- | --- | --- | --- |
| `GET` | `/notifications` | 登录用户 | 自己的通知；支持 `unreadOnly` |
| `GET` | `/notifications/unread-count` | 登录用户 | 未读数量 |
| `POST` | `/notifications/send` | 管理员 | 手动发送站内通知 |
| `PATCH` | `/notifications/:id/read` | 登录用户 | 标记单条已读 |
| `PATCH` | `/notifications/read-all` | 登录用户 | 全部已读 |
| `GET` | `/todos` | 管理员 | 自己的待办；支持 `status`、`unreadOnly` |
| `PATCH` | `/todos/:id/read` | 管理员 | 标记单条已读 |
| `PATCH` | `/todos/read-all` | 管理员 | 全部已读 |

发送给全部启用账号：

```json
{
  "title": "周五设备盘点提醒",
  "body": "请各位同事在本周五下班前确认设备归还状态。",
  "sendToAll": true
}
```

发送给指定用户：

```json
{
  "title": "设备归还提醒",
  "body": "请尽快完成设备归还。",
  "sendToAll": false,
  "recipientUserIds": ["2", "3"]
}
```

响应：

```json
{
  "sentCount": 2,
  "recipientUserIds": ["2", "3"]
}
```

每位接收人独立保存未读状态，通知会记录发送管理员，并通过 `notification.created` 事件实时推送。

## 7. WebSocket

客户端使用 Socket.IO 连接命名空间：

```js
import { io } from 'socket.io-client';

const socket = io('https://api.example.com/notifications', {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

服务端事件与数据见 [BACKEND_DESIGN.md](./BACKEND_DESIGN.md)。WebSocket 只用于及时提示；页面打开和重连后仍应调用通知、待办 REST 接口同步完整状态。

## 8. 错误格式

Nest 标准错误：

```json
{
  "statusCode": 409,
  "message": "资产当前不可借，不能批准该申请",
  "error": "Conflict"
}
```

数据库冲突由全局过滤器统一转换，不返回 SQL、表名或数据库凭据。
