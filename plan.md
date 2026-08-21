# ZK-CID 修复开发计划

基于 `zk-cid-audit-report.md`(2026-07-18 审查)的修复执行计划。
目标: 让项目核心声称(端到端 ZK 合规流程 + CRE 自动撤销)在代码层面站得住,仓库可提交、可构建、可复现。

## 阶段划分(严格 Stage-Gate)

### Phase 0 · Git 止血(主代理直接执行,先行且独占) — ✅ 已完成 (`44e298e`)
- 补全 `.gitignore`(typechain-types/、.workbuddy/、package-lock.json、IDE agent 目录)
- 删除根目录 `package-lock.json`(与 yarn4 锁文件冲突)
- 全量提交现有代码到本地仓库(不推送,团队 remote 由用户后续配置)
- 门禁: `git status` 干净

### Phase 1 · 合约层修复 + 真实测试(1 个 coder,独占 packages/hardhat) — ✅ 已完成 (`a261fcd`,15 passing)
下游 ABI 依赖本阶段产物,必须先完成。
- `ComplianceGate.sol`: ① `try/catch` 吞校验改为 `demoMode` 开关(false 时 validateProof 失败必须 revert);② `verifyCompliance`/`mint` 链路强制执行 `hasBeenRevoked` 检查;③ `verifyCompliance` 限制仅注册的 AccessNFT 可调(堵 mempool 抢跑);④ `issueCredential` 去重;⑤ `setWorkflow` 发事件
- `AccessNFT.sol`: mint 前检查凭证未撤销
- 删除占位测试,编写 6 条真实用例(权限 revert / 重放 revert / 重复 mint revert / 撤销生效 / happy path / 部署状态),跑通 `hardhat test`
- 删除陈旧 `coverage/` 报告;脚本统一改为从 `deployments/*.json` 读地址(消除硬编码)
- 门禁: `hardhat compile` + `hardhat test` 全部通过

### Phase 2 · 三个并行 coder(目录互不重叠) — ✅ 已完成 (`daa438f` 前端 / `574f876` CRE / `e9c0af0` mock-api)
1. **前端**(packages/nextjs): 从 Phase 1 编译产物修复 `deployedContracts.ts` ABI;修构建(补依赖、`--webpack`/`turbopack` 配置);`/zk-cid` 页对齐合约(单参 `verifyCompliance`、`hasMinted`);`tsc --noEmit` 归零;`next build` 通过;issuer/verify 页增加撤销事件可见性;假 DeFi 面板标注 Demo
2. **CRE 工作流**(workflows/): 按真实 `@chainlink/cre-sdk@1.16.0` API 重写(cron 触发器 + `cre.handler` + Runner 入口 + HTTPClient/EVMClient);补 `workflow.yaml`;消费 `config.json`;删除根目录陈旧 `main.js`;修乱码注释;evidence 目录补 README 说明(无 CRE CLI 时诚实标注模拟方式)
3. **Mock API**(mock-api/): 统一两套实现响应字段;Express admin 端点加 token 鉴权;补 `.env.example`/`.gitignore`/start 脚本;seed 数据移入配置
- 门禁: 各自构建/编译通过,无跨目录文件冲突

### Phase 3 · 文档与工程化统一(1 个 coder) — ✅ 已完成 (`31ed5c7`)
- README: 更新链上证据口径、增加 Quickstart 复现指南、增加 "Known Limitations / Demo Mode" 诚实说明
- `QA_PREP.md` 撤销口径与 README 对齐;PITCH_DECK 修正 Sepolia/Anvil 矛盾(占位链接留给用户填写)
- CI 增加 `yarn hardhat:test` 门禁;lint-staged 扩展 `.sol` 与 workflows/mock-api
- hardhat.config 的 Alchemy key 移入 .env.example 说明
- 门禁: 文档间无相互矛盾

### Phase 4 · 端到端验证与收口(1 个 coder) — ✅ 已完成 (本次验证: 四项全绿,详见 zk-cid-audit-report.md 修复闭环记录)
- 全量验证: hardhat compile+test、nextjs tsc+build、workflows tsc、mock-api 语法检查
- 分模块 conventional commits 最终提交
- 输出验证结果与遗留事项清单(视频录制、repo/demo 链接、CRE CLI 实测等需用户线下完成项)

### Phase 5 · TypeScript 类型检查清零 — ✅ 已完成
- `packages/hardhat` 不再把生成的 `typechain-types/` 纳入 `check-types`
- 移除 Hardhat 3 下已不兼容的 `namedAccounts` 配置
- 修正 `ci-deploy.ts`、`deploySepolia.ts`、`m3-demo.ts` 的脚本类型
- 为 `generateProofAndMint.ts` 补齐已实际使用的 Semaphore 包依赖
- 门禁: `yarn workspace @se-2/hardhat check-types` 零错误

## 不做的事(明确排除)
- 不推送任何 remote、不新建 GitHub 仓库(用户自行决定)
- 不录制 demo 视频、不填写 PITCH_DECK 的 repo/demo 链接占位符
- 不做 Sepolia 真实部署与 CRE CLI 真机模拟(无凭证/无 CLI,代码层面改对 + 诚实标注)
- 不启动常驻服务;所有验证用一次性命令完成
