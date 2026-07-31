# ZK-CID 项目完成情况审查报告

**审查日期**: 2026-07-18
**项目**: ZK-CID — 零知识合规身份 + 去中心化工作流编排(Chainlink 黑客松)
**审查方式**: 5 个并行只读审查代理(合约 / 前端 / CRE+Mock API / 文档交付物 / 工程化)

---

## 一、总体完成度评估

| 模块 | 完成度 | 一句话结论 |
|------|--------|-----------|
| 智能合约 (packages/hardhat) | ~45% | 骨架与演示脚本齐全可编译,但 ZK 校验被 bypass、撤销不真正生效、功能测试几乎为零 |
| 前端 (packages/nextjs) | ~50% | 页面与浏览器端真实 ZK proof 生成完成度高,但 ABI 缺失导致全部链上交互不可用,生产构建失败 |
| CRE 工作流 + Mock API | ~35% | 撤销编排逻辑写全了,但不是合法 CRE 工作流(虚构 SDK API、无触发器、无 workflow.yaml),simulate 证据为零 |
| 文档与交付物 | ~60% | README/Pitch/QA 成稿质量高,但文档声称领先于代码实际状态,缺视频、repo/demo 链接等硬性提交物 |
| 工程化与仓库卫生 | ~40% | 基础设施齐全但全继承 SE-2 模板;**核心代码 95+ 文件未提交进 git**,origin 仍指向上游模板仓库 |

**总体: 约 45%** — 演示链(发证→mock 验证→mint→脚本撤销)能跑通,但"已完成的黑客松提交"与当前实际状态差距明显。

---

## 二、致命问题(按优先级,均会直接影响评审)

### P0-1. 仓库是空壳:全部自研代码未提交 git
- `git status`: 95 修改 + 3 删除 + 30 未跟踪;合约、前端页面、workflows/、mock-api/、pitch 材料全部只在本地工作区。
- `origin` 仍指向 `https://github.com/scaffold-eth/scaffold-eth-2.git`,无团队 fork remote。评委 clone 仓库看不到任何 ZK-CID 代码;本地磁盘故障即全部丢失。

### P0-2. 链上 ZK 验证形同虚设
- `ComplianceGate.sol:81-85`: `try semaphore.validateProof(...) {} catch { /* 静默忽略 */ }` — 任何伪造 proof 都能通过验证并 mint NFT。核心卖点在链上不成立,评审看合约源码即击穿。

### P0-3. 撤销不防用,CRE 叙事未闭环
- `ComplianceGate.sol:56` `semaphore.removeMember` 被注释;`hasBeenRevoked` 写入后**全仓无任何读取方**。被撤销用户的 ZK proof 依然有效,README 宣称的"阻断后续 ZK Proof 验证"不成立。
- `workflows/compliance-lifecycle/main.ts` 使用的 SDK API 形态与实际安装的 `@chainlink/cre-sdk@1.16.0` 完全不匹配(虚构 `ctx.capabilities.*`,无 cron 触发器、无 `cre.handler`、无 Runner 入口、无 workflow.yaml),无法被 CRE CLI simulate 加载。实际演示走的是 `m3-demo.ts` 普通 ethers 脚本,与 DON 无关。
- `workflows/compliance-lifecycle/evidence/` 是空目录。

### P0-4. 前端 ABI 缺失,链上交互全灭
- `packages/nextjs/contracts/deployedContracts.ts` 只有 address 没有 abi;`tsc --noEmit` 30+ 错误;`next build` 失败(Turbopack/webpack 配置冲突 + 缺 lodash 依赖)。
- `app/zk-cid/page.tsx` 调用合约不存在的 `hasAccess` 和错误参数数量的 `verifyCompliance(2 参)`。

### P0-5. 功能测试为占位
- `test/ComplianceGate.test.ts` 唯一用例是 `expect(true).to.equal(true)`;`coverage/` 报告是旧版代码残留(误导性"证据")。CI 也无测试步骤。

### P1. 合约地址三套漂移
- README/DEMO_SUMMARY: `0xe7f1.../0x9fE4...`;当前部署产物: `0x162A.../0x922D...`;CRE workflow: `0x9A9f...`。README 中的 tx hash 无法在当前链状态复核。

### P2. 文档自相矛盾
- `QA_PREP.md:27` 说"还没有实现撤销功能",与 README 主打的 CRE 自动撤销叙事打架;PITCH_DECK 留 `[Link to Repo]`/`[Link to Live Demo]` 占位符;Slide 4 写 Sepolia 与 Anvil 本地链矛盾。

---

## 三、其他重要发现

**合约安全**:
- mempool 抢跑 griefing:`verifyCompliance` 无权限外部函数,攻击者可复制 mempool 中的 proof 抢先标记 nullifier 使受害者 mint 失败。
- `groupId=1` 硬编码且从不 `createGroup`,Sepolia 路径必然 revert。
- `issueCredential` 无去重;撤销循环 O(n) 无界;NFT 可自由转账且与凭证生命周期解耦(被制裁者可转走"合规通行证")。
- 脚本硬编码 Anvil 账户 #0 私钥与旧合约地址;hardhat.config 内嵌共享 Alchemy key。

**前端**:
- 首页仍是 SE-2 默认模板;`/user`+`/issuer`+`/verify` 与 `/zk-cid` 两套重复实现并存,hooks 双份身份不互通(commitment 需手动复制粘贴)。
- `/zk-cid` 的 "DeFi Dashboard" 余额硬编码 100 USDC;前端无任何 CRE 撤销可见性(无事件监听、无撤销列表)。
- `hooks/zk-cid/useProof.ts` 的新版 proof(scope=groupId, message=userAddress)是正确的防抢跑实现 — 值得保留。

**CRE/Mock API**:
- mock-api 两套实现(Express / Vercel serverless)响应字段不一致(`sanctioned` vs `sanctionedCommitments`),workflow 只认前者;Express 版 admin 端点无鉴权。
- 真实 CRE 写链走 Keystone Forwarder report,与合约现有 `onlyAuthorized + setWorkflow(burner)` 鉴权模型不兼容。
- `main.ts`/`main.js` 中文注释 GBK 乱码;根目录 `main.js` 是零地址陈旧产物。

**工程化**:
- 根目录 `yarn.lock` 与未跟踪的 `package-lock.json`(874KB)双锁文件冲突。
- `packages/hardhat/.env` 使用明文 `DEPLOYER_PRIVATE_KEY`(模板推荐加密 keystore),大提交时极易误提交。
- README 无 Quickstart,评委无法复现;lint-staged 不覆盖 .sol/workflows/mock-api。

---

## 四、优化建议路线图

### 第 1 天:止血(保住评审基本盘)
1. **提交全部代码**: 更新 .gitignore(追加 typechain-types/、.workbuddy/、package-lock.json、IDE agent 目录)→ 删除 package-lock.json → 按模块分 3-5 个 conventional commits → 建团队 fork remote 并推送。
2. **修前端 ABI**: 重跑 `yarn deploy` 让 generateTsAbis 重生成 deployedContracts.ts(或从 hardhat artifacts 手工补 ABI);补 lodash 依赖;build 脚本加 `--webpack` 或 next.config 加 `turbopack: {}`;`tsc --noEmit` 归零。
3. **统一地址单一事实源**: 重启 Anvil 重部署 → 新地址/tx hash 一次性回写 README、DEMO_SUMMARY、workflow config、前端;脚本全部改为读 `deployments/localhost/*.json`,私钥集中 .env。

### 第 2 天:让核心声称站得住
4. **补真实合约测试**(6 条核心用例即可): 权限 revert / nullifier 重放 revert / 重复 mint revert / 撤销生效 / mock 模式 happy path / 部署后状态正确。删除占位测试与陈旧 coverage 报告,CI 加 `yarn hardhat:test` 门禁。
5. **验证 bypass 改为 demoMode 开关**: `verifyCompliance` 加 `bool public demoMode`,false 时 validateProof 失败必须 revert;本地演示开、测试网关。
6. **撤销最小闭环(二选一)**:
   a) `verifyCompliance`/`AccessNFT.mint` 增加 `require(!hasBeenRevoked(commitment))` 检查 — 最低成本,撤销立即有实际效果;
   b) CRE 工作流传入真实 merkleProofSiblings 调 `semaphore.removeMember`。
   同步修 `QA_PREP.md:27` 与 README 口径,堵 mempool 抢跑(`verifyCompliance` 限制为仅 AccessNFT 可调)。
7. **前端对齐合约**: `/zk-cid` 的 `verifyCompliance` 改单参数、`hasAccess` 改读 `AccessNFT.hasMinted`;issuer/verify 页监听 `CredentialRevoked` 事件展示撤销列表(CRE bounty 的直接证据)。

### 第 3 天:交付物收口
8. **CRE 工作流改写为真实 SDK 形态**(决定赏金成败): `CronCapability().trigger({schedule})` + `cre.handler` + `Runner.newRunner()` 入口;HTTP/EVM 改用真实 HTTPClient/EVMClient API;补 workflow.yaml;消费 config.json 而非硬编码。跑 `cre workflow simulate` 并落盘证据到 evidence/。若时间不足,诚实降级为"脚本模拟 DON 行为"。
9. **补齐硬性提交物**: 录制 2-3 分钟 demo 视频(按 DEMO_SUMMARY 的录制方案),填 PITCH_DECK 的 repo/demo 链接占位符;README 增加 Quickstart 复现指南。
10. **文档口径统一 + 仓库清理**: 消除撤销叙事矛盾;重写/删除模板 CONTRIBUTING.md 与 funding.json;修乱码注释(转 UTF-8);删除陈旧 `main.js`、冗余截图;mock-api 两套字段对齐 + admin 加鉴权。

### 有余力再做
- 修 `groupId`(部署时 `createGroup` 注入);`issueCredential` 去重;NFT 加 tokenURI 与撤销联动(burn/status 标记);私钥改 `yarn account:generate` 加密 keystore;扩展 lint-staged 覆盖 .sol;收敛两套前端页面为一套;定制首页为 ZK-CID 落地页。

---

## 五、亮点(值得保留与宣传)

- 浏览器端真实 Semaphore proof 生成(`hooks/zk-cid/useProof.ts` 的 scope=groupId + message=userAddress 是教科书级防抢跑写法)。
- E2E 演示脚本链完整(deployDirect → issueCredential → generateProofAndMint → m3-demo),真实跑通过并有落盘证据。
- 文档写作质量高:PITCH_DECK 8 页框架完整、QA_PREP 的 Nullifier/Scope 技术解释准确、DEMO_SUMMARY 诚实记录已修复问题。
- 产品叙事清晰:"验证端隐私 + 颁发端去信任"的双重信任困境定位很好,商业化(可插拔合规中间件)讲法自洽。

**一句话结论**: 产品叙事和演示骨架已达黑客松水准,但"代码未提交、ZK 验证 bypass、CRE 不可模拟、测试占位、地址漂移"五个问题会让评审在 10 分钟内击穿核心声称。按第 1-2 天的止血 + 修复清单执行(约 2 天工作量),即可让全部核心声称基本站得住。

---

## 修复闭环记录 (2026-07-18)

**修复提交链**: `44e298e` 全量导入 → `a261fcd` 合约修复+15条测试 → `daa438f` 前端ABI+构建 → `574f876` CRE工作流重写 → `e9c0af0` mock-api → `31ed5c7` 文档与工程化 → 本次验证收口提交。

### 对照第二节逐项闭环

| 编号 | 状态 | 说明 |
|------|------|------|
| P0-1 仓库空壳 | ✅已修复 (`44e298e`) | 全部自研代码(合约/前端/workflows/mock-api/文档)已分模块提交入库,`git status` 干净。❌遗留: `origin` 仍指向 scaffold-eth-2 上游模板,团队 fork remote 待用户自行配置并推送(修复计划明确排除项)。 |
| P0-2 ZK 验证 bypass | ✅已修复 (`a261fcd`) | `verifyCompliance` 引入 `demoMode` 开关: demo 模式走 Mock 路径,严格模式(`demoMode=false`)下 `validateProof` 失败必然 revert。测试 "reverts on an invalid proof" / "accepts a valid proof" 双向覆盖。 |
| P0-3 撤销不防用 + CRE 未闭环 | ⚠️部分修复 | 合约侧✅(`a261fcd`): `verifyCompliance` 强制执行 `hasBeenRevoked` 检查,撤销立即生效,测试覆盖(撤销后验证被阻/双重撤销 revert/撤销后可重发证)。CRE 代码侧✅(`574f876`): 按真实 `@chainlink/cre-sdk` API 重写(cron 触发器 + handler + Runner 入口 + workflow.yaml + config.json),`tsc --noEmit` 0 错误。❌未实测: 本环境无 CRE CLI,`cre workflow simulate` 未运行,`evidence/` 仅有 README 诚实标注模拟方式。 |
| P0-4 前端 ABI 缺失 | ✅已修复 (`daa438f`) | `deployedContracts.ts` ABI 恢复,页面调用与合约对齐(单参 `verifyCompliance`、`hasMinted`)。本轮复验: `tsc --noEmit` 0 错误,`npm run build`(含 lint)通过,13 个静态页面全部生成。 |
| P0-5 测试占位 | ✅已修复 (`a261fcd`) | 占位测试已删,15 条真实用例全部 passing(本轮复验 15 passing / 565ms);陈旧 `coverage/` 目录已删;CI(`.github/workflows/lint.yaml`)已含 `yarn hardhat:test` 门禁。 |
| P1 地址三套漂移 | ⚠️部分修复 (`31ed5c7`) | README 链上证据表与 Known Limitations 已加诚实声明,明确"地址/tx 来自一次本地 Anvil 演示部署,以 `packages/hardhat/deployments/localhost/*.json` 为单一事实源"。字面地址仍不一致(README 历史记录 `0xe7f1.../0x9fE4...`、当前部署产物 `0x162A.../0x922D...`、workflow config `0x9A9f...`)——本地链重启后需重新部署并一次性回写,属演示性质遗留。 |
| P2 文档自相矛盾 | ✅已修复 (`31ed5c7`) | `QA_PREP.md` 撤销口径已与实现对齐(改为"撤销已实现+ZK Merkle 层已知限制"的诚实话术);PITCH_DECK 链名矛盾已修正为 "local Anvil testnet (Sepolia-ready)";README 增加 Quickstart 与 Known Limitations。❌遗留: PITCH_DECK 的 `[Link to Repo]`/`[Link to Live Demo]` 仍为 TODO 占位(按计划留给用户填写);demo 视频未录制。 |

### 本轮端到端复验结果 (Phase 4)

- **合约**: `hardhat compile --force` 通过(solc 0.8.30,4 个合约,仅 Mock 未用参数警告);`hardhat test --network hardhat` **15 passing**。
- **前端**: `tsc --noEmit` **0 错误**;`npm run build`(lint + TypeScript + 静态生成)**通过**,13 个路由全部产出。
- **CRE 工作流**: `tsc --noEmit` **0 错误**。
- **mock-api**: `node --check mock-api/server.js` **通过**。

### 本轮顺手修补(收口提交)

- `packages/hardhat/tsconfig.json`: `files` 引用不存在的 `hardhat.config.cts` → 修正为 `./hardhat.config.ts`。修正前 `check-types` 直接报 TS6053(文件不存在)失败;修正后暴露出 **144 条预存类型错误**(138 条在生成的 `typechain-types/`,为 node16 ESM 显式扩展名兼容问题;6 条在手写文件: `namedAccounts` 为 hardhat-deploy v1 残留、`generateProofAndMint.ts` 引用未安装的 semaphore 旧包、`m3-demo.ts` 两处隐式 any)。按预案不深修,保留修正并如实记录——引用恢复真实、错误从"被掩盖"变为"可见",仓库状态更健康;不影响 hardhat 编译与测试(测试经 tsx 转译,不走 tsc)。
- 环境修复(未入库): `packages/hardhat/node_modules/zod` 本地残缺副本(缺 package.json/index.js)已删除,回退使用根目录 hoist 的 zod@3.25.76;工具通知文件 `.hardhat-deploy-v2-notice` 按其自述("阅读后可删除")删除。
- 未提交: `opencode.json` 的本地改动(工具自动写入的 kimi-code MCP 配置),属本地工具状态。

### 最终遗留事项(需用户线下完成)

1. 录制 2-3 分钟 demo 视频(按 DEMO_SUMMARY 录制方案)。
2. 填写 PITCH_DECK 的 repo / live demo 链接占位符。
3. 配置团队 fork remote 并推送(当前 origin 指向上游模板仓库)。
4. 有 CRE CLI 环境后运行 `cre workflow simulate`,将证据落盘 `workflows/compliance-lifecycle/evidence/`。
5. Sepolia 真实部署(需真实 Semaphore 部署 + `setDemoMode(false)` + 私钥/_RPC 凭证)。
6. 本地链重启后: 重新部署 → 按 deployments/*.json 回写 README 证据表与 workflow config 地址。
7. 预存类型错误(可选): typechain node16 兼容、`namedAccounts` v1 残留、semaphore 旧包脚本清理。
