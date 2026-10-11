# ZK-CID 全面代码审计报告

- 审计执行：2026-10-09 ～ 2026-10-10
- 审计对象：`F:\AI WORK\WEB 3.0 Decentralized`（源码主体 `zk-cid/`）
- 审计范围：智能合约、Next.js 前端、Chainlink CRE 工作流、Mock 制裁 API、CI / 依赖 / 配置 / 仓库卫生
- 审计方式：静态代码审查 + 依赖漏洞扫描（`yarn npm audit`）+ 各包测试实跑 + Sepolia 线上合约与线上演示站点实测
- 关键结论：工程完成度与测试基本盘不错（合约 30 个用例全绿），但线上合约的 ZK 校验实际处于关闭状态，且前端 Merkle 树重建方式与链上不一致、CRE 批量撤销存在状态复用缺陷。这三项叠加会让"链上合规验证"的核心主张在评审或真实使用时直接失效。

> 证据说明：本报告中所有"实测"结论均可复现，命令见第九节。审计过程中未对任何线上合约发起写交易。

---

## 一、技术栈与主要模块

### 技术栈（实际锁定版本）

| 层 | 技术 | 版本 |
| --- | --- | --- |
| 包管理 | Yarn Workspaces 4（`nodeLinker: node-modules`） | 4.13.0 |
| 智能合约 | Solidity + Hardhat 3 | 0.8.28 / Hardhat 3.9.1 |
| 隐私协议 | Semaphore v4（contracts / group / identity / proof） | 4.14.2 ~ 4.14.3 |
| 合约库 | OpenZeppelin（ERC721 / Ownable） | 5.x |
| 前端 | Next.js App Router + React 19 | 16.2.10 / 19.2.x |
| Web3 前端 | wagmi / viem / RainbowKit | 2.19.5 / 2.39.0 / 2.2.9 |
| 状态与请求 | Zustand / TanStack Query | 5.0.12 / 5.59+ |
| 样式 | Tailwind CSS / daisyUI | 4.2.4 / 5.5.19 |
| 预言机编排 | Chainlink CRE SDK（WASM + DON 共识） | 1.16.0 |
| 默克尔树 | `@zk-kit/lean-imt` + 自实现 Poseidon2 | 2.2.5 |
| Mock 服务 | Express 5（本地）+ Vercel Node Functions（线上） | — |
| 测试 | Mocha/Chai、Vitest、Jest+Bun、Playwright | — |

### 主要模块与职责

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| 合规门合约 | `zk-cid/packages/hardhat/contracts/ComplianceGate.sol` | 发证、撤销、ZK 校验、Semaphore 组成员与稳定 leaves 管理 |
| 访问 NFT | `zk-cid/packages/hardhat/contracts/AccessNFT.sol` | 验证证明后铸造 ERC721 访问凭证（nullifier/地址防重） |
| CRE 接收适配器 | `zk-cid/packages/hardhat/contracts/cre/ComplianceGateReceiver.sol` | 接收 DON 签名报告，转发到门合约撤销入口 |
| 接收基类 | `zk-cid/packages/hardhat/contracts/cre/ReceiverTemplate.sol` | Forwarder / workflow 身份校验（vendored 自 CRE 模板） |
| 部署脚本 | `zk-cid/packages/hardhat/scripts/*.ts`、`deploy/*.ts` | Sepolia 部署、账户管理、冒烟演示、合约验证 |
| DApp 前端 | `zk-cid/packages/nextjs/app/zk-cid/page.tsx`（676 行） | 三 Tab 主流程：身份 → 发证 → 证明 → 铸造 |
| 前端 Hooks | `zk-cid/packages/nextjs/hooks/zk-cid/*` | 身份生成/派生、浏览器端 ZK 证明生成 |
| 制裁名单代理 | `zk-cid/packages/nextjs/app/api/sanctions/route.ts` | 同源代理 Mock 制裁名单 |
| CRE 工作流 | `zk-cid/workflows/compliance-lifecycle/core.ts` | Cron → 拉名单 → 读链 → DON 报告 → 树级撤销 |
| Mock 制裁 API | `zk-cid/mock-api/server.js` + `api/*.ts` + `lib/store.ts` | 演示用制裁名单读写（Express / Vercel 双实现） |
| CI | `.github/workflows/ci.yml` | 编译、合约测试、lint、类型检查、前端构建 |

### 核心数据流

浏览器本地生成 Semaphore 身份 → Issuer（或 CRE）调用 `ComplianceGate.issueCredential` 把 commitment 加入链上群组 → 用户本地生成 ZK 证明（message 绑定钱包地址防抢跑）→ `AccessNFT.mint` 经 `ComplianceGate.verifyCompliance` 校验后铸造 → CRE Cron 每 5 分钟拉取制裁名单，与链上成员求交集，命中者经 Keystone Forwarder → `ComplianceGateReceiver` → `ComplianceGate.revokeCredentialWithMerkleProof` 做树级撤销。

---

## 二、实测状态（客观事实）

| 核验项 | 实测结果 |
| --- | --- |
| `ComplianceGate.demoMode()` @ `0x1b8ae78C…4F70`（Sepolia） | **true（ZK 校验被跳过）** |
| `getMembers()` / `getLeaves()` | 1 个成员 / `[0, 0, <成员>]`（3 个叶子，groupId = 712，depth = 2） |
| Semaphore 链上组根（groupId 712） | `19120656036690252621860078919366676338739630874061673546862425326408660196542` |
| 前端重建根（同数据，见 H2） | `new Group(getMembers())` = 成员值本身，**与链上根不一致** |
| `issuer()` | `0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348` |
| `creWorkflow()` | `0xB5ad6413a16efd82b76212830f908B2D67C20425`（Receiver 适配器，已接对） |
| `AccessNFT.nextTokenId()` @ `0x5e7140b8…` | **0（该线上合约从未铸造过 NFT）** |
| README 引用的 Mint tx `0x6b60a901…` | Sepolia `eth_getTransactionByHash` 返回 null（仅存在于本地链） |
| CRE 撤销 tx `0xb64c050e…` | Sepolia 存在且成功（from = issuer EOA → `0x15fc6ae9…` MockKeystoneForwarder，演练用） |
| Receiver `getForwarderAddress()` | `0xF8344CFd…4482`（Sepolia 官方 Keystone Forwarder，正确） |
| Receiver `getExpectedAuthor/WorkflowName/WorkflowId()` | **全部为零值（未固定任何工作流身份）** |
| 线上 Mock API 鉴权 | 无 token / `dev-token` 均 401（线上已正确设置 `ADMIN_TOKEN`） |
| 线上前端 JS bundle | 未发现演示私钥字面量（`NEXT_PUBLIC_DEMO_ISSUER_KEY` 当前未配置） |
| 本地 `packages/hardhat/.env` | 未入 git 历史；其中 `DEPLOYER_PRIVATE_KEY` 派生地址 **与线上 issuer 完全一致（0x951c…）** |
| 根目录 `.vercel/.env` | 存在明文 Vercel Token（`vcp_…`），未入 git 历史 |
| 依赖审计 `yarn npm audit -A` | 3 critical + 6 high + 13 moderate + 1 low（共 23 条，22 个唯一 GHSA） |
| 仓库体积 | git pack 约 226 MiB；单个 31.3 MB mp4 已入库 |

---

## 三、高严重度问题（H）

### H1. 线上合约 `demoMode = true`：ZK 校验与成员校验双双缺失，任何人可铸造 AccessNFT

- 文件：`zk-cid/packages/hardhat/contracts/ComplianceGate.sol:72`、`:158-174`；`zk-cid/packages/hardhat/contracts/AccessNFT.sol:24-40`
- 问题：构造函数硬编码 `demoMode = true`，仓库内没有任何脚本/CI 在部署后调用 `setDemoMode(false)`（`scripts/deploySepolia.ts:76-86` 只设置了 accessNFT / verifier / workflow），线上实测仍为 true。demoMode 分支只检查 nullifier 未使用，以及 `hasBeenRevoked[proof.merkleTreeRoot]`——而该映射的键空间是 commitment（`:29`、`:132-134`），用 Merkle root 去查属语义错误，永远不会命中；既不验证证明对应成员在组内，也不验证 root 等于当前组根。
- 影响：任意钱包可用伪造 proof（points 全零、message 填自己地址）直接 `mint`，完全绕过身份、制裁名单与撤销逻辑。"链上合规网关""撤销即阻断"的对外主张在线上不成立。
- 改进建议：① 线上立即 `setDemoMode(false)`（注意：必须与 H2 修复同时上线，否则 mint 会全部 revert）；② 把 demoMode 改为构造参数并加部署断言（`require(!gate.demoMode())`），CI 部署门禁阻断；③ demoMode 下至少校验 `proof.merkleTreeRoot == semaphore.getMerkleTreeRoot(groupId)`；④ 前端在 `demoMode === true` 时显示醒目警示（页面已读取该字段，只需强化展示）。

### H2. 前端 Merkle 树重建方式错误：用 `getMembers()`（紧凑数组）而非 `getLeaves()`（含置零稳定叶子）

- 文件：`zk-cid/packages/nextjs/app/zk-cid/page.tsx:44-56`（`groupMembers` 来自 `getMembers`）、`zk-cid/packages/nextjs/hooks/zk-cid/useProof.ts:28`（`new Group(groupMembers)`）
- 问题：链上 Semaphore 撤销是把叶子置零并保留位置（`ComplianceGate` 的 `leaves` 数组同步维护该语义）。前端却用"活跃成员紧凑列表"重建树。实测对比：链上 group 712 的根 = `19120656036690252621860078919366676338739630874061673546862425326408660196542`，等于用 `[0, 0, c]` 重建的根；而前端 `new Group([c])` 的根 = `1234567890…789`（单叶即叶值），两者不等，depth 2 vs 0。任何一次撤销之后，前端生成的 proof 在严格模式下必然验证失败。
- 影响：一旦关闭 demoMode，主流程"生成证明 → 铸造"会直接 revert（且当前 demoMode 恰好掩盖了该缺陷）；同时 `members` 数组用 swap-delete 维护，顺序与树序也不一致，属于同一错误来源。
- 改进建议：前端改读 `getLeaves()`，用 `new Group(leaves.map(String))`（`Group` 构造函数允许 0 值叶子）重建；把"链上 leaves → Group"封装为共享工具并由前端与 CRE 工作流共用；补一条"撤销后仍能生成有效证明并铸造"的集成测试。

### H3. CRE 批量撤销复用陈旧 Merkle 证明，且失败仍上报成功

- 文件：`zk-cid/workflows/compliance-lifecycle/core.ts:180-190`（只读一次 leaves）、`:216-258`（循环内逐笔写入并汇总）
- 问题：`leaves` 与 `members` 只在循环前读取一次。第一笔撤销落链后，Semaphore 树根与兄弟路径已变化，后续成员仍使用撤销前的 `merkleProofSiblings`，`removeMember` 会因 Merkle 校验失败而 revert；循环对失败只 `runtime.log` 后继续，最终仍返回 `status: "revoked"`。
- 依赖层证据：`zk-cid/packages/hardhat/node_modules/@zk-kit/lean-imt.sol/InternalLeanIMT.sol:291-293` 的 `_update` 要求 `oldRoot == _root(self)`，否则 `revert WrongSiblingNodes()`——第一笔撤销改变根之后，第二笔用旧 leaves 算出的 siblings 必然对不上。
- 影响：制裁名单一次命中多个链上成员时，通常只有第一个被真正撤销，其余静默失败，且对外汇报为成功——对合规系统属于高风险漏撤。
- 改进建议：每成功撤销一笔后重新读取 `getLeaves()` 并重算下一笔证明（或单成员确认后再进入下一轮）；返回值增加 `failedCount/failedList`，存在失败时返回 `partial`/`failed` 并触发告警；补多成员批量撤销回归用例。

### H4. CRE 接收合约未固定工作流身份：任意经同一 Forwarder 的报告都能触发撤销

- 文件：`zk-cid/packages/hardhat/contracts/cre/ReceiverTemplate.sol:57-88`；线上实测 `getExpectedAuthor/getExpectedWorkflowName/getExpectedWorkflowId` 全为零
- 问题：只校验 `msg.sender == forwarder`；workflow 身份三项均为 0（不校验）。任何部署在同一 Keystone Forwarder 之上的报表都会被接受并转发为 `revokeCredentialWithMerkleProof`。
- 影响：攻击面从"指定工作流"扩大到"任何经该 Forwarder 的工作流"，可被用于任意撤销合规凭证（拒绝服务型破坏），削弱撤销路径的可信度。
- 改进建议：调用 `setExpectedAuthor` + `setExpectedWorkflowId`（可选 name）固定唯一工作流；把三项写入部署脚本并在 CI 断言非零；增加 owner 两段式交接（当前 `Ownable` 一步转移即可，见 M16）。

### H5. 凭证撤销后已铸造的 AccessNFT 仍然有效，且同一地址无法重新铸造

- 文件：`zk-cid/packages/hardhat/contracts/AccessNFT.sol:10`（`hasMinted`）、`:13`（`usedNullifiers`）、`:24-40`（mint）；`ComplianceGate.sol:118-155`（撤销）
- 问题：撤销只影响后续证明校验，对已经 mint 的 NFT 没有冻结、销毁或"实时合规"查询入口；同时 `hasMinted[address]` 永久为 true，被撤销后重新发证也无法再次 mint。
- 影响：被制裁用户在撤销前铸造即可继续使用该凭证（若业务方只检查 NFT 持有关系），撤销的业务价值被削弱；而合规用户被误撤后则被永久锁死，两种方向都不符合预期。
- 改进建议：提供 `isCompliant(address/tokenId)` 实时组合查询（gate `isMember` / `hasBeenRevoked`），或支持撤销时冻结/销毁对应 token 并在重发证后允许重新铸造；若坚持链下校验，需在 README 与评审材料中显式标注该边界。

### H6. 依赖存在 3 个 critical / 6 个 high 漏洞（Next.js 16.2.10 为主要来源）

- 文件：`zk-cid/packages/nextjs/package.json:38`（`"next": "^16.2.10"`）、`zk-cid/yarn.lock`（锁定 16.2.10）
- 问题（`yarn npm audit -A` 实测，3 critical + 6 high）：
  - critical `next`：GHSA-p293-qw3h-jr36（Windows 托管服务器未授权 RCE）、GHSA-2xp9-vwfh-vxw4（Image Optimization AVIF RCE）、GHSA-vcvr-r3jv-pc5j（`next/og` ImageResponse RCE）
  - high `next`：GHSA-6gpp-xcg3-4w24（中间件/代理绕过）、GHSA-m99w-x7hq-7vfj（Server Actions DoS）、GHSA-89xv-2m56-2m9x 与 GHSA-p9j2-gv94-2wf4（SSRF）、GHSA-cjq9-62q9-8jv4（Image Optimization SSRF）
  - high `postcss@8.5.16`：GHSA-r28c-9q8g-f849（sourceMappingURL 路径穿越）
- 影响：Vercel 线上实例暴露于 Image Optimization RCE/SSRF 与缓存投毒；自托管（尤其 Windows）直接命中 critical RCE。
- 改进建议：升级 Next.js ≥ 16.3.8、postcss ≥ 8.5.18 并更新锁文件；CI 增加 `yarn npm audit` 并以 critical/high 阻断合并；短期无法升级时禁用远程 Image Optimization 与未使用的 ImageResponse 路由。

### H7. 敏感凭证管理不规范：明文私钥与明文 Vercel Token 存于工作区

- 文件：`zk-cid/packages/hardhat/.env`（未跟踪，含 `DEPLOYER_PRIVATE_KEY`，派生地址与线上 issuer `0x951c…` 完全一致）、根目录 `.vercel/.env`（未跟踪，含明文 `VERCEL_TOKEN=vcp_…`）
- 问题：两者都未进入 git 历史（已用 `git log -S` 与 `git ls-files` 核验），但均以明文持久化在工作目录中；`.vercel/.env` 里的项目级 Token 本不应落盘（Vercel CLI 标准做法是 CI secret / 环境变量）。同时 hardhat 脚本对多个网络默认回退到公开的 Anvil 私钥（见 M9）。
- 影响：工作区一旦被同步、打包、截图或共享，攻击者可获得 issuer 权限（发证、撤销、改 verifier/workflow/demoMode）与 Vercel 项目控制权。issuer 不可转移（见 M16），泄露后必须重部署整套合约并迁移前端地址。
- 改进建议：① 立即轮换 Vercel Token 并删除该文件；② 把部署私钥迁移到硬件钱包或 `yarn account:generate` 加密 keystore，环境变量仅在会话内注入；③ 若该 issuer 私钥接触过任何共享通道，按"已泄露"处理：新部署 + 迁移 `creWorkflow`/verifier/前端地址；④ 用 git-secrets / gitleaks 之类做提交前扫描。

---

## 四、中严重度问题（M）

### M1. 制裁名单条目未校验直接 `BigInt()`，脏数据中断整轮工作流

- 文件：`zk-cid/workflows/compliance-lifecycle/core.ts:194-196`（`BigInt(entry)`）、`:163-164`（`JSON.parse`）；`zk-cid/mock-api/api/admin.ts:27,30`、`zk-cid/mock-api/server.js:119,122`（add/remove 仅做 `String()`，无格式校验）
- 问题：上游只要能写入一条非数字/超长字符串，`BigInt` 即抛异常，整轮 Cron 崩溃、所有撤销被跳过；也没有名单条数与单条长度上限。
- 影响：单条脏数据即可让合规撤销停摆（fail-closed DoS），且日志难定位到具体条目。
- 改进建议：`try/catch` + 正则/字段范围过滤（十进制、0 < v < BN254 素数、长度上限）并记录被丢弃条目；限制名单总条数；把"名单为空"、"部分条目非法"、"解析失败"作为不同状态上报。

### M2. 工作流对失败写链仍返回成功状态

- 文件：`zk-cid/workflows/compliance-lifecycle/core.ts:237-258`
- 问题：`txStatus !== TxStatus.SUCCESS` 时仅打印日志，返回体仍为 `status: "revoked"`，无失败清单。
- 影响：监控与人工复核无法区分"全部成功"与"部分失败"，漏撤难以暴露（与 H3 叠加放大）。
- 改进建议：返回 `failedList/failedCount`，存在失败时 `status: "partial"` 或 `"failed"`；接入告警与重试（幂等：以链上 `hasBeenRevoked`/`isMember` 为准）。

### M3. 制裁名单代理用 HTTP 200 返回错误，调用方分不清"服务故障"与"无人被制裁"

- 文件：`zk-cid/packages/nextjs/app/api/sanctions/route.ts:26-47`
- 问题：上游非 2xx 或超时/异常时统一返回 200 + `sanctioned: []` + `error` 字段。
- 影响：合规语境下"名单不可用"会被页面上读成"无命中"，具有误导性；任何复用该接口的调用方也会踩坑。
- 改进建议：返回 502/504 等真实状态码（保留 `error` 字段），前端区分"名单不可用"与"无命中"并在页面显著提示；增加短 TTL 缓存与超时上限校验（`Number.isFinite`）。

### M4. Mock API 使用进程内存储：Vercel 多实例不一致、冷启动即重置；且 Express/Vercel 双实现重复

- 文件：`zk-cid/mock-api/lib/store.ts:23-39`（`globalThis.__sanctions`）、`zk-cid/mock-api/api/*.ts` 与 `server.js`（两套等价实现）
- 问题：数据存于函数实例内存。Serverless 并发扩展时 admin 写入在其它实例不可见，实例回收即丢失；线上观察 `updatedAt` 随冷启动刷新。两套实现需要人工保持行为一致，历史上已出现过字段漂移。
- 影响：CRE 读取的制裁名单可能与演示操作不一致，演示结果不确定；双实现增加维护与回归成本。
- 改进建议：改用 Vercel KV/Upstash 或静态配置（`SEED_SANCTIONED`）作为唯一事实源；收敛为一套实现（Vercel handler），Express 仅作为共享同一 store 的本地壳。

### M5. Admin 默认 token、CORS 全开、无速率限制

- 文件：`zk-cid/mock-api/server.js:35`（`ADMIN_TOKEN ?? "dev-token"`）、`:99`（`cors()` 全开）、`:111`；`zk-cid/mock-api/api/admin.ts:18`
- 问题：代码保留公开默认 token，部署时忘设 `ADMIN_TOKEN` 即等同公开写权限；CORS `*` 与无速率限制使名单可被任意读写/刷接口。
- 影响：可被清空或注入制裁名单，进而触发/阻止链上撤销；线上部署本次实测已拒绝 `dev-token`（401），风险主要落在自建/复刻部署。
- 改进建议：生产环境未设置 `ADMIN_TOKEN` 时直接拒绝启动（fail-fast）；默认改为强随机并要求显式配置；收紧 CORS 白名单；加简单速率限制与请求体大小限制。

### M6. `scope = groupId` 使"每个身份每个业务域只能出一次证明"

- 文件：`zk-cid/packages/nextjs/hooks/zk-cid/useProof.ts:30-33`（scope = groupId）、`zk-cid/packages/hardhat/contracts/AccessNFT.sol:26`、`ComplianceGate.sol:159`
- 问题：Semaphore 的 nullifier 只由 `(identity, scope)` 决定，与 message/业务无关；同一身份在同一 groupId 下的第二个证明必然命中 `Replay detected` / `Proof already used`。当前 Gate 与 NFT 还各自记录一份 nullifier。
- 影响：扩展到多 DeFi 协议或多业务场景时，第二个场景永远无法验证；语义上把"一个身份一次"隐含成了"一个群组一次"。
- 改进建议：定义业务域 scope（如 `hash(appId, chainId, businessId, groupId)`）并让 nullifier 记录按业务域隔离；把双份 nullifier 记录收敛到单一权威来源；文档明确"每身份每业务域一次"。

### M7. 前端身份派生使用固定签名文案且不做任何持久化

- 文件：`zk-cid/packages/nextjs/hooks/zk-cid/useIdentity.ts:12-33`
- 问题：`createDeterministicIdentity` 的签名文案固定（`Nonce: 1`，无 domain / chainId / 时效），同一钱包在任何站点都能得到同一签名派生同一 commitment；两种身份方式都只存 React state，刷新即丢失。
- 影响：固定签名可被跨站点重放；刷新后用户误以为凭据失效；链上 commitment 可能变成无法再证明的"孤儿"。
- 改进建议：签名文案加入 domain separator、chainId、随机 nonce 与过期时间；以用户口令派生密钥 + IndexedDB 加密持久化身份，或在 UI 明确提示"刷新需重新生成"。

### M8. `page.tsx` 676 行单体承载全部业务；另有语义不同的死代码 Hook

- 文件：`zk-cid/packages/nextjs/app/zk-cid/page.tsx:1-676`；`zk-cid/packages/nextjs/hooks/useProof.ts:1-31`（全仓库无引用，且 `message=scope`、无地址绑定，与 `hooks/zk-cid/useProof.ts` 语义相反）
- 问题：5 个合约读、2 个写 Hook、制裁拉取、演示发证钱包与三 Tab UI 全部内联；异常处理基本是 `catch (e: any) → toast`；写操作前不显式校验 chainId；部分提交入口未统一防连点；死代码 Hook 若被误用会把防抢跑设计破坏掉。
- 影响：难测试、难维护；错误网络/连点导致重复交易与误导性报错；RPC 抖动直接失败。
- 改进建议：按 Tab 拆组件，抽出 `useSanctions`/`useComplianceGate` 等 hooks 并加超时重试与状态机化错误处理；写操作前统一 `useSwitchChain` 校验并用 `isPending` 禁用按钮；删除死代码 `hooks/useProof.ts`。

### M9. Hardhat 网络配置对所有链默认使用公开 Anvil 私钥，且残留大量与本项目无关的多链配置

- 文件：`zk-cid/packages/hardhat/hardhat.config.ts:9-12`（默认回退 `0xac0974…`）、`:66-151`（mainnet/optimism/arbitrum/… 20+ 网络全部使用该回退）
- 问题：在未配置 `DEPLOYER_PRIVATE_KEY` 时，对任何网络都会使用公开已知的 Anvil 账户私钥。虽然是零余额地址，但模板配置会误导使用者、触发安全扫描告警，也掩盖"忘记配置"的真实错误。
- 改进建议：仅本地网络允许默认私钥；http 网络在缺少 `DEPLOYER_PRIVATE_KEY` 时启动即报错；删除项目不涉及的网络配置，只保留 sepolia（+本地）。

### M10. `runHardhatDeployWithPK.ts` 逻辑错误且不安全

- 文件：`zk-cid/packages/hardhat/scripts/runHardhatDeployWithPK.ts:13-18`（硬编码 Anvil 私钥/死代码 `if (false)`）、`:38-42`（忽略 `--network`，固定 `["--network", "localhost", "deploy", …]`，并用 `spawn("echo y | npx hardhat", …, { shell: true })`）
- 问题：脚本名义上支持网络选择，实际永远部署到 localhost；参数拼接与 shell 组合脆弱；`--network` 之后的值可能被重复追加造成参数歧义。
- 影响：误用会得到与预期网络不符的部署结果；脚本可维护性差，容易被复制到其它流程。
- 改进建议：重写或删除该脚本，统一使用 `scripts/deploySepolia.ts` / `deployDirect.ts`；避免 `shell: true`，使用参数数组调用 `npx`。

### M11. mock-api 构建配置不规范

- 文件：`zk-cid/mock-api/tsconfig.json`（无 `outDir`、无 `include`）、`zk-cid/mock-api/package.json`（`build: tsc`；`express ^5.2.1` 搭配 `@types/express ^4.17.21`）
- 问题：`tsc` 会把 `api/*.js`、`lib/*.js` 直接生成在源码目录，污染工作区并可能被部署平台误当作源码；Express 5 与 v4 类型不匹配，类型检查无法反映真实运行时 API。
- 改进建议：设置 `outDir: dist`、`rootDir`、`include`，并让构建产物进入 `.gitignore`；把 `@types/express` 升到 v5，或移除未使用的类型依赖（源码仅用 `@vercel/node` 类型）。

### M12. 构建可绕过类型错误并可能被用于生产发布

- 文件：`zk-cid/packages/nextjs/next.config.ts:7`（`ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true"`）、`zk-cid/packages/nextjs/package.json:14`（`vercel:yolo` 注入该变量）
- 问题：`NEXT_PUBLIC_` 变量会被内联进客户端构建，同时被用来控制构建期类型检查，语义不当；`vercel:yolo` 提供了"带类型错误上线"的快捷方式。
- 影响：类型损坏的构建有现实路径进入生产；把构建开关暴露为公开 env 也增加误配置面。
- 改进建议：改用服务端变量（`IGNORE_BUILD_ERROR`），CI 禁止该变量，删除或重命名 `vercel:yolo` 脚本。

### M13. 测试体系存在"存在但不可运行/不执行"的窟窿

- 文件：`zk-cid/packages/nextjs/package.json:5-14`（无 `test` 脚本）、`zk-cid/packages/nextjs/hooks/zk-cid/useProof.test.ts`、`zk-cid/workflows/compliance-lifecycle/package.json:8-12`、`zk-cid/workflows/compliance-lifecycle/jest.config.cjs`、`zk-cid/playwright.config.ts`、`.github/workflows/ci.yml:50-74`
- 问题（均为实跑结论）：前端 Vitest 4/4 失败（缺 `environment: jsdom`，`document is not defined`）且无 test 脚本、CI 不跑；工作流 `jest` 直接报 `SyntaxError: Missing initializer in const declaration`（未配置 TS 转换，0 用例执行），真正的 `test:sim`（依赖 `npx -y bun@1.2.21`）未进 CI；Playwright 依赖 `@playwright/test` 未安装、无脚本、无 CI；依赖审计未进 CI。
- 影响：前端、工作流与端到端路径没有自动化回归保护；H2/H3 这类缺陷无法被现有 CI 拦截。
- 改进建议：补 `vitest.config.ts`（jsdom）与 `test` 脚本；修 Jest 配置或统一改跑 Bun 仿真测试；CI 增加前端单测、`test:sim`、Playwright（或至少 build+启动烟雾）与 `yarn npm audit` 门禁；加 Dependabot/Renovate。

### M14. 30MB 演示视频入库 + 对外证据口径需收紧

- 文件：`zk-cid/packages/nextjs/public/demo/zk-cid-pitch-video-en.mp4`（31,338,684 字节，已跟踪）；`zk-cid/README.md:103-122`、`zk-cid/deliverables/*`
- 问题：单个视频直接进入 git 历史；且线上 `AccessNFT.nextTokenId() = 0`，README 引用的 mint tx 在 Sepolia 不存在（实测 `eth_getTransactionByHash` 返回 null，为本地链证据）。材料虽有小字标注"本地主链路"，但对外容易读成"线上闭环已跑通"。
- 补充（实测）：CRE 工作流尚未部署到 CRE 网络，线上成员仍包含 Mock 制裁名单中的同一 commitment（`1234567890…789`），即"制裁自动撤销"在线上并未处于运行状态；`zk-cid/README.md:138` 有披露，但首屏与对外材料未做同等区分。
- 影响：克隆/CI/部署包变慢；评审若按"线上闭环"核验会直接对不上。
- 改进建议：视频迁移到 Vercel Blob/对象存储或 Git LFS；在 README/Dora 提交中明确区分"本地端到端证据"与"Sepolia 线上证据"；若要宣称线上闭环，先在 Sepolia 完成一次真实 mint 并附 tx。

### M15. 文档与实现命名漂移

- 文件：`zk-cid/QA_PREP.md:41`（称 `verifyCompliance` 有 `onlyAccessNFT` 限制）vs `zk-cid/packages/hardhat/contracts/ComplianceGate.sol:38-39,60-66,158`（实际为 `onlyVerifier` + `verifiers` 映射）
- 影响：QA/评审问答口径与代码不一致，容易被认为是文档先行。
- 改进建议：统一术语（`onlyVerifier` / verifier registry），同步 README、QA_PREP、PITCH 材料，并在 CI 里校验关键术语不存在于文档（可选）。

### M16. `issuer` 不可转移、无暂停机制

- 文件：`zk-cid/packages/hardhat/contracts/ComplianceGate.sol:25`（`issuer` 状态变量）、`:76-96`（全部 admin 入口 `onlyIssuer`）
- 问题：issuer 在构造函数固定，无转移/交接；合约无 pause/emergency stop，也无升级代理。
- 影响：私钥丢失或泄露时无法轮换管理员，只能重部署并迁移全部地址与前端；异常期间无法紧急停发证。
- 改进建议：引入 `Ownable2Step`/`AccessControl` 与 `Pausable`，issuer 交接两步确认；把权限边界与轮换流程写入运维文档。

### M17. 依赖漂移与重复安装：同一依赖多版本并存

- 文件：`zk-cid/yarn.lock`、`zk-cid/.yarnrc.yml:11`（`nmHoistingLimits: workspaces`）、`zk-cid/package.json`、`zk-cid/packages/hardhat/package.json`、`zk-cid/packages/nextjs/package.json`
- 问题（实测锁定/安装版本）：`viem` 在锁文件中存在 **2.23.2 / 2.34.0 / 2.39.0 / 2.55.0 四份**（根 2.34.0、nextjs 2.39.0、hardhat 2.55.0）；`@types/node` 同时存在 16/18/20/22/26 多个主版本，而 engines 要求 Node ≥ 22；hardhat 包同时声明 `hardhat-toolbox@^7`、`hardhat-toolbox-mocha-ethers@^3`、`hardhat-ignition*` 与 `@rocketh/*` 多套工具链，实际 `hardhat.config.ts` 只使用其中两套；根 `package.json` 与子包重复声明 `@chainlink/cre-sdk`、`hardhat`、`typescript`。
- 影响：安装体积与依赖审计噪声成倍增长（见 H6），升级与漏洞修复需要多处同步；类型定义与运行时不一致会掩盖真实类型错误；未使用依赖扩大供应链攻击面。
- 改进建议：用 `yarn constraints` / `resolutions` 统一 `viem`、`@types/node`、`@semaphore-protocol/*`；删除未使用的 hardhat 插件与重复声明；CI 增加依赖审计门槛并启用 Dependabot/Renovate。

---

## 五、低严重度问题（L）

1. `setVerifier` 不发出事件（`ComplianceGate.sol:90-92`），权限变更链下不可审计。建议加 `VerifierUpdated(address indexed, bool)`。
2. `.env.example` 覆盖不全：`zk-cid/packages/nextjs/.env.example` 未记录 `SANCTIONS_API_URL`、`SANCTIONS_API_TIMEOUT_MS`、`NEXT_PUBLIC_DEMO_ISSUER_KEY`；`zk-cid/mock-api/.env.example:11` 预填了线上同款演示 commitment，复制即默认把该值视为受制裁。
3. 内置第三方默认 Key：`zk-cid/packages/nextjs/scaffold.config.ts:12`（Alchemy）、`:44`（WalletConnect 项目 ID）为 SE-2 模板默认值，公开但可被滥用消耗配额。建议缺失即报错或换自有 Key。
4. 生产导航保留模板路由 `/debug`、`/blockexplorer/*`、`/zk-test`（`zk-cid/packages/nextjs/components/Header.tsx:24-44`、`app/page.tsx`），增加无关攻击面与构建体积。
5. 前端未监听 `CredentialRevoked` / `CredentialRevokedFromTree` 事件（仅 ABI 中存在），页面无法展示"因制裁被撤销"的实时证据，CRE 叙事缺少可见性。
6. 仓库残留 `zk-cid/packages/nextjs/build.log`、`eslint.log`、`tsc.log`、`tsconfig.tsbuildinfo`、根目录 `mock-smoke*.pid`、`tmp_new/`，以及结论已过期的 `zk-cid-audit-report.md`（其"修复闭环"与线上 demoMode 现状不符）。
7. `zk-cid/workflows/compliance-lifecycle/main.ts:15-19` 顶层直接 `main()` 且无 `.catch`，Runner 初始化失败会变成未处理的 rejection，证据日志中错误上下文不足。
8. 历史提交与脚本中多次出现公开的 Anvil 默认私钥（`0xac0974…`），无实际资金风险，但会被密钥扫描器持续告警；建议集中到测试常量并加注释说明。
9. 本地工作区体积较大（`zk-cid/` 约 6.6 GB，含 node_modules；`tmp/` 与 `video-production/` 各约 1 GB），虽多数被 gitignore，但影响本地磁盘与检索性能，建议定期清理。
10. 配置地址缺少单一事实源：Sepolia 地址散落在 `zk-cid/workflows/compliance-lifecycle/config.json:3-7`、`.env.example`、`zk-cid/packages/nextjs/contracts/deployedContracts.ts`、`zk-cid/SEPOLIA_DEPLOYMENT.md:9-11` 与 README 至少 5 处，目前靠人工同步（本次审计中 config.json 与前端 ABI 恰好一致）。建议以 `deployments/sepolia/*.json` 为唯一真源，由脚本生成前端/工作流配置，并在 CI 加地址一致性检查。

---

## 六、测试与 CI 覆盖实跑结果

| 模块 | 现有测试 | 实跑结果 | 主要缺口 |
| --- | --- | --- | --- |
| 合约 | `packages/hardhat/test/ComplianceGate.test.ts`、`ComplianceGateReceiver.test.ts` | **30 passing** | 无真实 Semaphore 集成；demoMode 下缺"非成员/已被撤销者无法铸造"的负向用例；无 NFT 撤销后失效用例 |
| Mock API | `mock-api/test/sanctions-list.test.ts` | **5 passing** | 无 admin 鉴权/非法 commitment/并发与持久化用例 |
| CRE 工作流 | `workflows/.../test/*.ts` | Jest **suite failed（0 用例）**；`test:sim` 需 `npx -y bun@1.2.21` 且未进 CI | 多成员批量撤销（H3）、写链失败、脏名单、超长名单 |
| 前端 | `hooks/zk-cid/useProof.test.ts` | **4 failed**（`document is not defined`） | 身份派生、链切换、防连点、制裁代理错误语义；未进 CI |
| E2E | `e2e/zk-cid-flow.spec.ts`（5 个冒烟用例） | **无法运行**（`@playwright/test` 未安装） | 真实"发证 → 证明 → 铸造"链路 |
| 类型检查 | 三个包 `tsc --noEmit` | nextjs / mock-api / workflow 全部 **exit 0** | 无 |

CI（`.github/workflows/ci.yml`）当前覆盖：install、hardhat compile/test/check-types/lint、next lint/check-types/build、workflow compile、mock-api test。未覆盖：前端单测、工作流仿真测试、E2E、依赖审计。

---

## 七、可执行优化建议（按优先级，含验收标准）

### P0（当天，先止血）

1. **凭证轮换**：删除 `.vercel/.env` 并轮换 Vercel Token；把 `packages/hardhat/.env` 私钥迁到硬件钱包/加密 keystore，评估该 issuer 是否按"已泄露"处理（若泄露需新部署 + 迁移 `creWorkflow`/verifier/前端地址）。验收：仓库内外均无明文私钥/Token，旧 Token 失效。
2. **依赖升级**：Next.js → ≥ 16.3.8、postcss → ≥ 8.5.18，重跑构建；CI 增加 `yarn npm audit` critical/high 阻断。验收：audit 无 critical/high，`next build` 通过。
3. **关闭 demoMode 并修复配套**：先完成 H2（前端改 `getLeaves()`），再对线上 `setDemoMode(false)`；部署脚本增加 `assert(!demoMode)`。验收：线上 `demoMode() == false`，前端用真实 proof 成功 mint 一笔并附 tx。
4. **固定 CRE 接收方工作流身份**：对 Receiver 调用 `setExpectedAuthor` + `setExpectedWorkflowId`（可选 name）。验收：`getExpectedAuthor/Id` 非零，其它工作流报告会 revert。

### P1（本周）

5. **修复 CRE 批量撤销**：逐笔重读 `getLeaves()` 重算证明；失败返回 `partial/failed` + 告警；补多成员回归用例（覆盖 H3）。验收：3 名成员同时命中可全部撤销且状态正确。
6. **输入与错误语义加固**：`core.ts` 的名单解析加校验/上限；`route.ts` 失败返回 502/504；mock-api admin 校验 commitment 为十进制合法值。验收：注入脏数据不中断整轮，仅条目被丢弃并有日志。
7. **Mock API 治理**：生产未设 `ADMIN_TOKEN` 拒绝启动；CORS 白名单 + 速率限制；存储改 KV/静态源或文档标注限制。验收：无 token 写入返回 401，跨实例可见性满足演示需求。
8. **测试接入 CI**：前端 vitest jsdom + `test` 脚本；工作流 `test:sim` 与 E2E（或 build+smoke）；启用 Dependabot。验收：CI 全绿且新增 3 类测试步骤。
9. **合约加固**：删除 `hasBeenRevoked[proof.merkleTreeRoot]` 错误检查（改为按 commitment / 当前根校验）；`setVerifier` 加事件；为 NFT 增加撤销失效/重新铸造机制；issuer 改 `Ownable2Step` + `Pausable`。验收：新增用例覆盖"撤销后不可 mint/不可继续使用"与权限轮换。

### P2（下一次迭代）

10. **架构与可读性**：拆分 `page.tsx` 为 Tab 组件 + 数据 hooks；删除死代码 `hooks/useProof.ts`；统一 `members/leaves` 语义到共享工具（前端与 CRE 共用）。
11. **依赖收敛**：用 `yarn constraints`/resolutions 统一 `@semaphore-protocol/*`、`@types/node` 等版本，删除根与子包重复声明。
12. **仓库瘦身与文档口径**：视频外置（Vercel Blob/LFS）；清理日志/pid/过期报告；README/Dora 明确本地证据 vs Sepolia 证据；修正 `QA_PREP.md` 的 `onlyAccessNFT` 术语。

---

## 八、亮点（建议保留并向评审强调）

- 合约测试基础扎实：30 个 Mocha 用例覆盖权限、重放、重复铸造、撤销、O(1) 成员删除与严格模式；Mock API 5 个用例通过。
- CRE 广播路径有真实 Sepolia 交易证据（`0xb64c050e…`：Forwarder → Receiver → Gate 成功），且适配器方案避免重部署已验证的 Gate。
- 用 `@zk-kit/lean-imt` + 自实现 Poseidon2 替代依赖浏览器 `atob` 的 `poseidon-lite`，真实解决了 CRE WASM 运行时的兼容缺陷。
- 防抢跑设计正确：`onlyVerifier` 限制 + `message == msg.sender` 绑定 + CEI（先置状态后外部调用）。
- 线上 Mock API 已启用 admin token（实测拒绝默认 token）；线上前端未打包演示私钥（实测）。
- README 对 Demo Mode、本地/线上证据差异有主动披露，诚实度高于同类项目。

---

## 九、复现命令与限制说明

```text
# 合约测试（30 passing）
node .yarn/releases/yarn-4.13.0.cjs workspace @se-2/hardhat test

# Mock API 测试（5 passing）
zk-cid/mock-api/node_modules/.bin/vitest run --root zk-cid/mock-api

# 前端单测（当前 4 failed：document is not defined）
zk-cid/packages/nextjs/node_modules/.bin/vitest run --root zk-cid/packages/nextjs

# 工作流测试（当前 suite failed：未配置 TS 转换；仿真测试需 bun）
node .yarn/releases/yarn-4.13.0.cjs workspace compliance-lifecycle test

# 类型检查（三包均 exit 0）
zk-cid/node_modules/.bin/tsc -p zk-cid/packages/nextjs/tsconfig.json --noEmit
zk-cid/mock-api/node_modules/.bin/tsc -p zk-cid/mock-api/tsconfig.json --noEmit
zk-cid/workflows/compliance-lifecycle/node_modules/.bin/tsc -p zk-cid/workflows/compliance-lifecycle/tsconfig.json --noEmit

# 依赖审计（3 critical / 6 high / 13 moderate / 1 low）
node .yarn/releases/yarn-4.13.0.cjs npm audit -A

# 线上状态（只读）
Sepolia RPC: demoMode()=true; groupId=712; getMembers()=1; AccessNFT.nextTokenId()=0
Receiver: forwarder=0xF8344CFd…4482; expectedAuthor/Name/Id 全零
Mock API: 无 token / dev-token 均 401
```

限制说明：未执行 Slither/Mythril/Echidna 等符号执行或模糊测试；未对已部署字节码做逐字节反编译比对；未发起任何真实写链操作；依赖审计结果受扫描时点（2026-10-09）影响，升级后需复扫。

---

## 十、修复记录（2026-10-10 第一轮，代码侧）

| 编号 | 修复内容 | 关键改动 | 验证 |
| --- | --- | --- | --- |
| H1 | `ComplianceGate` 构造默认 `demoMode = false`（严格模式），只有部署脚本显式 `DEMO_MODE=true` 或 issuer 主动调用才能打开；demo 模式也强制 `proof.merkleTreeRoot == 当前组根`；删除 `hasBeenRevoked[proof.merkleTreeRoot]` 误用；`setVerifier` 新增 `VerifierUpdated` 事件。**线上 Sepolia 已执行 `setDemoMode(false)`（2026-10-10，tx `0xaab09625…ca2f`，独立 RPC 复核实测 `demoMode=false`）** | `ComplianceGate.sol`、`MockSemaphore.sol`、部署脚本、`scripts/setStrictMode.ts` | 合约测试 34 passing + 线上复核 |
| H2 | 前端改用 `getLeaves()`（含置零稳定叶子）重建 Merkle 树，并加链上根回归测试 | `app/zk-cid/page.tsx`、`hooks/zk-cid/useProof.ts`、`utils/zk-cid/groupRoot.test.ts` | 根快照测试（`[0,0,c]` 重建根 == 链上根） |
| H3 | CRE 批量撤销每笔写入后重读 `getMembers()/getLeaves()`；失败以 `partial/failed + failedCount/failed[]` 上报 | `workflows/compliance-lifecycle/core.ts`、`test/compliance-lifecycle.sim.test.ts` | bun 仿真 9 passing（含 3 成员批量、写失败部分成功） |
| H4 | Receiver 部署脚本在未设置 `EXPECTED_WORKFLOW_AUTHOR + EXPECTED_WORKFLOW_ID` 时拒绝部署（`ALLOW_UNPINNED_RECEIVER=true` 为显式逃生口） | `deployComplianceGateReceiver.ts`、`hardhat/.env.example`、`SEPOLIA_DEPLOYMENT.md` | hardhat check-types 0 错误 |
| H5 | `AccessNFT` 增加 `revokeAccess/restoreAccess/isValid`，被撤销地址不可转移 token | `AccessNFT.sol`、`ComplianceGate.test.ts` | 合约测试 34 passing |
| H6 | `next` → `^16.3.8`、`postcss` → `^8.5.28`；CI 增加依赖审计门禁；新增 `.github/dependabot.yml` | `nextjs/package.json`、`yarn.lock`、`.github/workflows/ci.yml`、`.github/dependabot.yml` | `yarn npm audit -A --severity high` → **No audit suggestions**（critical/high = 0） |
| H7 | 演示私钥从浏览器移到服务端 `/api/demo-issue`（`DEMO_ISSUER_KEY`，仅暴露 `issueCredential`，带限流与 issuer 匹配校验）；本地 `.vercel` token 与 issuer 私钥的轮换仍需人工执行 | `app/api/demo-issue/route.ts`、`app/zk-cid/page.tsx`、`nextjs/.env.example` | tsc 0 错误 |
| M1 | 制裁名单输入校验：工作流 `parseSanctionedEntries`、mock API `validateCommitment`、seed 过滤 | `core.ts`、`mock-api/lib/validate.ts`、`api/admin.ts`、`server.js`、`lib/store.ts` | mock-api 测试 13 passing |
| M2 | 写链失败不再静默返回 `status: revoked` | `core.ts` | bun 仿真（partial 用例） |
| M3 | `/api/sanctions` 上游失败返回 502、超时 504、其它 500，并校验超时配置 | `app/api/sanctions/route.ts` | nextjs tsc 0 错误 |
| M5 | `ADMIN_TOKEN` 生产 fail-fast、CORS 白名单 `CORS_ORIGINS`、admin 限流 `ADMIN_RATE_LIMIT`、启动日志不再回显 token | `mock-api/lib/auth.ts`、`api/admin.ts`、`server.js`、`.env.example`、`README.md` | mock-api 测试 13 passing |
| M7 | 身份派生签名改为 domain + chainId + wallet 绑定的稳定文案 | `hooks/zk-cid/useIdentity.ts` | nextjs tsc 0 错误 |
| M8 | 删除无引用且语义冲突的死代码 `hooks/useProof.ts` | — | 全仓引用检索为空 |
| M13 | 前端 vitest 配置（jsdom）+ `test` 脚本 + CI 增加 `typegen`、前端单测、workflow jest、CRE 仿真、Playwright E2E、依赖审计；E2E 改为对生产构建跑 `next start` | `vitest.config.ts`、`nextjs/package.json`、`zk-cid/package.json`、`playwright.config.ts`、`e2e/zk-cid-flow.spec.ts`、`.github/workflows/ci.yml` | 前端 7 passing；workflow jest 3 + 仿真 9；E2E **6 passing**；`next build` 通过 |
| 运维 | 新增 `setStrictMode.ts` / `configureReceiverIdentity.ts`（校验 issuer/owner、写入后断言）与对应 npm 脚本，供线上关闭 demoMode、固定 workflow 身份 | `scripts/setStrictMode.ts`、`scripts/configureReceiverIdentity.ts`、`hardhat/package.json`、`zk-cid/package.json` | hardhat check-types 0 错误 |
| M14/M15 | 文档同步：README 已知限制、SEPOLIA_DEPLOYMENT 生产缺口、QA_PREP 术语 | `README.md`、`SEPOLIA_DEPLOYMENT.md`、`QA_PREP.md` | — |

**仍需人工/线上执行（代码无法代替）**

1. 轮换 Vercel Token（`.vercel/.env`）与 issuer 私钥；如按"已泄露"处理，需要新部署并迁移 `creWorkflow` / verifier / 前端地址。
2. ~~对已部署的 Sepolia `ComplianceGate` 执行 `setDemoMode(false)`~~ 已完成（2026-10-10，tx `0xaab09625…ca2f`）。剩余：对已部署的 `ComplianceGateReceiver` 设置 `EXPECTED_WORKFLOW_AUTHOR` + `EXPECTED_WORKFLOW_ID` 后执行 `yarn hardhat:configure:receiver`。
3. ~~把修复后的前端/服务端部署到 Vercel~~ 已完成（`main` → 生产部署 READY，线上 `/zk-cid`、`/api/sanctions` 正常，前端 bundle 不含私钥）。~~服务端 `DEMO_ISSUER_KEY`~~ 也已完成（2026-10-11，仅 production 环境变量；`/api/demo-issue` 实测 `enabled:true` 且 issuer 与链上一致，真实发证 tx `0x6206c00f…` + 撤销 tx `0x5d04c889…`，生产 UI 冒烟通过）。
4. 将 CRE 工作流部署到 CRE 网络（当前仅有本地 simulate 证据）。
5. ~~重新生成 `packages/nextjs/contracts/deployedContracts.ts`~~ 已完成（2026-10-11，指向 v2 `0x7A52…`）。

---

## 十一、第二轮闭环（2026-10-11）

| 事项 | 处理 | 证据 |
| --- | --- | --- |
| H5 线上生效 | 线上 `AccessNFT` 替换为含 `revokeAccess / restoreAccess / isValid` 的 v2：`0x7A52459d8eEF432fa3F044c152dd36ba1F3F931f`（deploy tx `0x50fcc360…`）。`ComplianceGate.accessNFT` 与 verifier 注册均指向 v2，v1（`0x5e7140b8…`）已解绑；**线上字节码与本仓库编译产物 keccak 完全一致**；Blockscout + Sourcify 均已验证 | 链上读回、keccak 比对（`0x699b0e44…`）、`hardhat-verify` 输出 |
| M9 | Hardhat 网络配置不再对所有网络回退公开 Anvil 私钥：仅本地 `default` 网络保留回退；远程网络缺少 `DEPLOYER_PRIVATE_KEY` 时不再注入签名者 | `hardhat.config.ts`（18 处替换）+ `hardhat:check-types` 0 错误 |
| M11 | mock-api `tsconfig` 增加 `outDir/rootDir/include`，构建产物不再写入源码目录；删除未使用的 `@types/express` / `@types/cors`（Express 5 与 v4 类型错配问题随之消失） | `mock-api tsc --noEmit` 0 错误 |
| M12 | `ignoreBuildErrors` 改用服务端变量 `IGNORE_BUILD_ERROR`（不再是 `NEXT_PUBLIC_`），并删除 `vercel:yolo` 脚本（nextjs 与根级） | `next build` 通过 |
| M17 | 依赖声明收敛：`@types/node` 全仓统一 `^22.12.0`；`@semaphore-protocol/*` 统一 `^4.14.3`。`viem` 多副本来自上游精确 pin（cre-sdk 2.34.0 / walletconnect 2.23.2 / nextjs 2.39.0），强推单版本会破坏上游工具链，保留并记录 | `yarn why viem`、`yarn.lock` |
| L3 | README 补充模板默认 key 说明（SE-2 公共共享 key，生产应自配） | `zk-cid/README.md` |
| L4 | 生产导航与首页移除模板调试入口（`/debug` 路由保留、可直访）；`/zk-test` 作为独立演示页保留 | `Header.tsx`、`app/page.tsx` diff |
| L5 | 前端新增「链上撤销记录（实时监听）」面板（监听 `CredentialRevokedFromTree`） | E2E 冒烟 |
| L6 | 清理残留日志/pid（18 个未跟踪文件）；`zk-cid-audit-report.md`、`plan.md` 顶部加 SUPERSEDED 横幅 | `git status` |
| L7 | workflow `main()` 顶层增加 `.catch` + `process.exit(1)` | workflow `tsc` 0 错误 |
| L8 | 本地 Anvil 私钥集中到 `scripts/localDev.ts`（6 个脚本引用，标注 LOCAL USE ONLY） | hardhat check-types |
| L10 | 新增 `tools/check-address-consistency.mjs`：deployment 记录 ↔ workflow 配置 ↔ 前端生成文件三方比对；接入 `yarn check:addresses` 与 CI | 实跑通过 |
| 文档 | 根 README / SEPOLIA_DEPLOYMENT / DORA_SUBMISSION / FINAL_SUBMISSION_CHECKLIST 的 AccessNFT 地址统一为 v2 | 上述文件 |

**保留决策（有意的 won't-fix，附原因）**

- **M4** mock-api 进程内存储：读取路径已由 `SEED_SANCTIONED` 种子在冷启动时确定化，admin 写入仍是尽力而为；彻底修复需要引入外部 KV（Vercel KV/Redis），属基础设施决策，不在本次扩大范围。
- **M14** 29 MB 演示视频：文件已在已发布的历史提交中，重写历史会失效外部引用（提交哈希、DoraHacks 链接），保留现状。
- **L9** 本地 `tmp/` 与 `video-production/`（各约 1 GB，均未跟踪）：属本地素材，未清理。

**当前剩余外部项（代码与脚本均已就绪，等待触发条件）**

1. `yarn hardhat:configure:receiver`：等 CRE 网络部署权限批下来后，用真实的 `EXPECTED_WORKFLOW_AUTHOR` / `EXPECTED_WORKFLOW_ID` 执行。
2. issuer 私钥轮换到硬件钱包/keystore（线下决定；轮换会改变 issuer 地址，需要重新部署并迁移）。
3. 把 CRE 工作流部署到 CRE 网络（`cre workflow deploy compliance-lifecycle -T production-settings`）。
