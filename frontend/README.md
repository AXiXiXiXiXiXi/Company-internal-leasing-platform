# 固定资产借还前端

Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus。

## 启动

先确认后端运行在 `http://localhost:3000`，然后：

```powershell
cd E:\AiCode\Desktop_program\frontend
npm install
npm run dev
```

开发地址：`http://localhost:5173`

开发服务器会代理以下请求，避免浏览器跨域：

- `/api` → `http://localhost:3000`
- `/socket.io` → `http://localhost:3000`

Socket.IO 命名空间仍为 `/notifications`。

## 构建

```powershell
npm run build
npm run preview
```

生产构建位于 `frontend/dist`。部署时建议前端与后端置于同一域名，由反向代理把 `/api`、`/socket.io` 转发给 NestJS。若使用独立域名，需要同步配置后端 `CORS_ORIGINS` 和 `VITE_SOCKET_URL`。

## 环境变量

```env
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=/notifications
```

## 页面

| 路由 | 管理员 | 员工 |
| --- | --- | --- |
| `/dashboard` | 审批、交接、借出、逾期概览 | 我的申请、当前借用概览 |
| `/assets` | 台账维护、维修/报废 | 查询资产并发起申请 |
| `/applications` | 批准、驳回、确认借出 | 查看进度、取消待审批申请 |
| `/loans` | 当前、逾期、历史、登记归还 | 查看自己的借还记录 |
| `/notifications` | 通知和管理员待办 | 个人站内通知 |
| `/users` | 用户、角色、状态、密码重置 | 无权限 |

## 前端说明

- Token 和登录用户保存在 `sessionStorage`。
- `401` 会清理会话并返回登录页；`403` 保留当前页面并显示权限错误。
- 新建、审批、交接和归还操作都包含提交中状态与重复操作防护。
- 桌面使用数据表格，手机使用卡片列表，不使用横向宽表。
- 日期显示为浏览器本地时间，接口仍使用 UTC ISO 8601。
- 页面设计规范见 [FRONTEND_DESIGN.md](./docs/FRONTEND_DESIGN.md)。

管理员可在通知页选择全部启用账号或指定用户发送站内通知，通知会持久化并实时推送。
