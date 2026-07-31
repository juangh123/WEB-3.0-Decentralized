# ZK-CID Mock Sanctions API

模拟 OFAC SDN 制裁名单的 mock API,供 CRE `compliance-lifecycle` 工作流消费。
存在两套行为一致的实现:

- **Express 本地开发服务器** — `server.js`
- **Vercel serverless 函数** — `api/sanctions-list.ts` + `api/admin.ts`(共享 `lib/store.ts`)

## 启动

```bash
cd mock-api
npm install
cp .env.example .env   # 可选:按需修改 PORT / ADMIN_TOKEN / SEED_SANCTIONED
npm start              # = node server.js,默认 http://localhost:3001
```

Vercel 部署时在项目环境变量中设置 `ADMIN_TOKEN`(以及可选的 `SEED_SANCTIONED`)。

## 端点

两套实现行为一致:

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/sanctions-list` | 无 | 返回统一 schema:`{ sanctioned: string[], source: string, updatedAt: string }` |
| POST | `/api/admin/sanction`(Vercel 为 `/api/admin`;Express 两个路径都支持) | `x-admin-token` 头 | body:`{ action, commitment? }`,`action ∈ add \| remove \| clear \| status`,返回 `{ ok: true, data: <同上的统一 schema> }` |

鉴权 token 从环境变量 `ADMIN_TOKEN` 读取,默认 `dev-token`(仅本地演示用)。

## 与 CRE workflow 的对接

`workflows/compliance-lifecycle/main.ts` 中的 `CONFIG.sanctionsApiUrl`
(默认 `http://localhost:3001/api/sanctions-list`)指向本服务的 GET 端点。
工作流读取响应的 `data.sanctioned`(字符串数组)与 `data.source`,
将 `sanctioned` 中的 commitment 与链上 `getMembers()` 返回的 commitment
比对,对命中的成员自动执行 `revokeCredential()`。因此:

- 响应必须包含 `sanctioned`(字符串形式的十进制 commitment)和 `source` 字段;
- 更换部署地址时同步修改 workflow 的 `sanctionsApiUrl`。

## 演示前:把真实 commitment 加入制裁名单

服务默认以**空名单**启动(不再硬编码假 commitment)。三种方式添加:

1. **Admin API(推荐,演示中可动态添加):**

   ```bash
   curl -X POST http://localhost:3001/api/admin/sanction \
     -H "x-admin-token: dev-token" \
     -H "Content-Type: application/json" \
     -d '{"action":"add","commitment":"<链上真实 commitment 的十进制字符串>"}'
   ```

2. **环境变量 seed:** 在 `.env` 中设置 `SEED_SANCTIONED=<c1>,<c2>` 后重启(Express);
   Vercel 侧在环境变量中设置同名变量。

3. **seed.json(仅 Express):** 在 `mock-api/seed.json` 写
   `["<c1>", "<c2>"]` 或 `{ "sanctioned": ["<c1>"] }` 后重启。

验证当前名单:

```bash
curl -X POST http://localhost:3001/api/admin/sanction \
  -H "x-admin-token: dev-token" -H "Content-Type: application/json" \
  -d '{"action":"status"}'
```
