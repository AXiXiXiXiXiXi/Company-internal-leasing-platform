# 固定资产借还后端

NestJS + TypeORM + MySQL 8.0 后端，数据库结构以仓库根目录的 `database/schema.sql` 为准。应用运行时设置 `synchronize: false`，不会自动修改已有表结构。

## 环境要求

- Node.js 22+
- MySQL 8.0.16+
- 已执行 `database/schema.sql`

## 配置和启动

```bash
cd backend
copy .env.example .env
npm install
npm run build
npm run start:dev
```

必须真实填写 `.env` 中的数据库连接信息，并将 `JWT_SECRET` 设置为至少 32 个随机字符。生产环境的 CORS 只填写实际前端域名。

生成随机 JWT 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

启动后：

- API：`http://localhost:3000/api`
- Swagger：`http://localhost:3000/api/docs`
- 健康检查：`http://localhost:3000/api/health`
- WebSocket 命名空间：`ws://localhost:3000/notifications`

已有通知表升级时执行 [20261102_add_notification_sender.sql](../database/migrations/20261102_add_notification_sender.sql)，该迁移为管理员手动通知增加发送人字段。

## 重置种子用户密码

当前数据库中的 Argon2 哈希是占位符，登录前必须重置：

```bash
npm run auth:reset-password -- --username admin01
npm run auth:reset-password -- --username zhangsan
```

脚本从 `.env` 读取数据库连接，并交互式隐藏密码输入。不要在命令行参数中传密码。

## 验证

```bash
npm test
npm run build
```

接口和业务约束见 [API.md](./docs/API.md) 与 [BACKEND_DESIGN.md](./docs/BACKEND_DESIGN.md)。
