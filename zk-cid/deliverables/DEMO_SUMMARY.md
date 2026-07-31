# ZK-CID Hackathon Demo 录制报告

**日期**: 2026-07-15（链上证据已于 2026-07-19 本地完整重部署后刷新）
**状态**: 核心流程已跑通，截图已就绪

---

## M2 主赛道 Demo 流程 (ZK Identity → NFT Mint)

### 步骤概览

| 步骤 | 操作 | 结果 | 截图 |
|------|------|------|------|
| 1 | 进入 /demo 对比页 | 展示传统 Web3 vs ZK-CID 隐私对比 | `demo-00-landing.png` |
| 2 | 进入 /user 生成身份 | Semaphore Identity 已生成 | `demo-02-identity.png` |
| 3 | Issuer 颁发合规凭证 | Commitment 上链加入 ComplianceGroup | `demo-03-issued-success.png` |
| 4 | 本地生成 ZK Proof | Semaphore 证明已生成 | (终端输出) |
| 5 | 链上提交证明 Mint NFT | Token #0 铸造成功 | (链上确认) |

### 链上状态

> 已于 **2026-07-19 本地完整重部署** 后刷新为最新链上证据（含 M3 撤销记录）。

```
ComplianceGate:   0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
AccessNFT:        0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
MockSemaphore:    0x5FbDB2315678afecb367f032d93F642f64180aa3

Members(撤销前):  ["5971644768800692991947631472118425334028045883019724522721770548264953610582"]
Members(撤销后):  []  (hasBeenRevoked[commitment] = true)
NFT Token #0:     Owner = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Issuance Tx:      0x93064d9effc3b57a26c946f5fb49609a3e0f491b0a4f1352ab43ba67524d9158
Mint Tx:          0x6b60a9014547c375c8d7bb20ec77686a38fd46882314824dbb36b435f1974adc (Block 7)
Revoke Tx:        0x497fd6ba8d5bd5c0837435ef1b1e6d3150bf961b8ad0611db2ac11734ea7448c (Block 8)
撤销后再次 Mint:  revert "Credential revoked"（预期拦截）
```

### ZK Proof 数据

```
Nullifier: 14380812933768887131295643276977020379755876539891335886836834504769825251676
Root:      5971644768800692991947631472118425334028045883019724522721770548264953610582
Depth:     1
```

---

## M3 CRE Workflow 路径

- Mock 制裁 API: `http://localhost:3001/api/sanctions-list` → 返回 `["1234567890"]`
- Workflow 已编译: `workflows/compliance-lifecycle/dist/main.js`
- ComplianceGate 地址已配置

### M3 Demo 录制步骤

```bash
# 1. 在 workflows 目录使用 CRE SDK CLI 模拟触发
cd workflows/compliance-lifecycle
# 使用 CRE SDK simulate 命令
# 2. Workflow 自动拉取 API → 比对 members → 提交 revokeCredential
```

---

## 录制注意事项

### 已修复的问题
1. `@heroicons/react` 导入错误 → 已替换为纯文本按钮 (`app/user/page.tsx`)
2. Turbopack/webpack 冲突 → 已用 `--webpack` 标志启动
3. Burner wallet 地址非 Issuer → 发证/Mint 走脚本, UI 展示结果

### 建议的直播录制方案
1. **M2**: 用 OBS 录浏览器: 打开 /demo（对比页）→ /user（已生成身份）→ /issuer（已发证）→ 展示链上 tx
2. **M3**: 终端录屏: 展示 CRE Workflow 执行 + Mock API 调用 + 合约撤销
3. **剪辑**: 将截图作为 slides 插入视频

### 当前运行中的服务
- Hardhat Node: `http://127.0.0.1:8545` (PID 杀掉后需重启)
- Next.js: `http://localhost:3000`
- Mock API: `http://localhost:3001`


---

## 2026-07-18 修复记录

黑客松初次提交后,对全仓库做了一轮"代码—文档一致性"修复,四个提交的要点如下:

- **`a261fcd` fix(contracts)**:ComplianceGate 新增 `demoMode`(默认 true,仅 issuer 可改;置 false 后 Semaphore `validateProof` 失败必 revert);`verifyCompliance` 强制检查 `hasBeenRevoked`;新增 onlyAccessNFT 限制(外部 EOA 不能直调,唯一验证路径为 `AccessNFT.mint`);`issueCredential` 去重、`setWorkflow` 发事件、groupId 改由 `createGroup` 生成。`hardhat test` 15 passing;陈旧的 coverage/ 报告已删除。
- **`daa438f` fix(nextjs)**:`deployedContracts.ts` ABI 补全;`tsc` 0 错误;`next build --webpack` 通过;首页改为 ZK-CID 落地页;`/user`、`/issuer`、`/verify` 转为 Legacy 页(顶部徽章标注),主演示路径迁移至 `/zk-cid`;issuer/verify 页新增 `CredentialRevoked` 事件展示。
- **`574f876` feat(workflows)**:CRE 工作流按真实 `@chainlink/cre-sdk@1.16.0` API 重写(CronCapability 触发器 + `cre.handler` + `Runner.newRunner` + HTTPClient 共识 + `EVMClient.callContract` + `runtime.report`/`writeReport`);新增 `workflow.yaml`,统一消费 `config.json`;`tsc` 编译通过。本机无 CRE CLI,simulate 未实测,复现命令与已知风险见 `workflows/compliance-lifecycle/evidence/README.md`。
- **`e9c0af0` fix(mock-api)**:统一响应 schema 为 `{ sanctioned, source, updatedAt }`;admin 端点增加 `x-admin-token` 鉴权(默认 `dev-token`);seed 改走 `SEED_SANCTIONED` 环境变量;补充 README。

> 注:本文档上文的合约地址与交易哈希已随 **2026-07-19 本地完整重部署** 刷新（含 M3 撤销 tx 与撤销后拦截证据）;重启本地链后,最新地址请以 `packages/hardhat/deployments/localhost/*.json` 为准。
