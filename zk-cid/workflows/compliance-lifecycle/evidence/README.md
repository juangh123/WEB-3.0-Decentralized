# Evidence: compliance-lifecycle CRE 工作流

## 当前状态(诚实声明)

代码已对齐 **本机实际安装的 `@chainlink/cre-sdk@1.16.0`** 的真实 API
(依据 `node_modules/@chainlink/cre-sdk/dist/` 下的类型声明逐条核对):

- Cron 触发器:`new CronCapability().trigger({ schedule })`
- 入口装配:`cre.handler(trigger, fn)` + `Runner.newRunner<Config>()`
- HTTP:`HTTPClient.sendRequest(runtime, fn, consensusIdenticalAggregation<string>())`
  (节点模式 + DON 一致性共识),配合 `ok()` / `text()` 响应助手
- EVM 读:`EVMClient.callContract(runtime, { call: encodeCallMsg(...), blockNumber: LAST_FINALIZED_BLOCK_NUMBER })`
- EVM 写:`runtime.report(prepareReportRequest(callData))` 生成 DON 签名报告,
  再由 `EVMClient.writeReport(runtime, { receiver, report, gasConfig })` 递交上链
- 配置:全部经 `runtime.config` 消费 `config.json`,无硬编码地址/URL

`main.ts` 已通过 `tsc -p workflows/compliance-lifecycle/tsconfig.json`
类型检查并产出 `dist/main.js`(零错误)。

### 已完成的真实 CRE 编译证据

一键复现脚本(镜像到无空格路径 + build + simulate,输出自动写入本目录):

```powershell
cd zk-cid\workflows
.\run-cre-simulate.ps1          # 需要凭证,二选一见下
```

凭证有两种给法(都不是必须写进命令):

```powershell
# 方式 A:交互式登录(浏览器授权,一次性)
cre login                        # 或直接运行仓库内的 cre_v1.36.0_windows_amd64.exe login

# 方式 B:非交互 API key(适合 CI/自动化)
Copy-Item .\compliance-lifecycle\.env.example .\compliance-lifecycle\.env
# 编辑 .env,填入 CRE_API_KEY=<在 https://app.chain.link → Account Settings → API Keys 创建>
.\run-cre-simulate.ps1
```

脚本会自动加载 `workflows/.env` 或 `workflows/compliance-lifecycle/.env`(两者都被 gitignore)。

只验证编译、不跑 simulate:`.\run-cre-simulate.ps1 -BuildOnly`

`cre-simulate-<时间戳>.log` 为该脚本的原始输出。仓库内已有一份
`cre-simulate-20261002-192709.log`(BuildOnly,官方 CLI 编译成功)。

**官方 CRE CLI v1.36.0 已实测编译通过**(2026-10-02,Windows):

```powershell
# 注意:需先把 compliance-lifecycle 复制到不含空格的路径(见下方前置条件)
cd <无空格路径>\workflows
cre workflow build compliance-lifecycle -T staging-settings
# ✓ Workflow compiled successfully
# Binary hash: 482ea06d8a701e60b8149e1bea2f7ad7f53c14b85e8c2598575decafe0f9e31a  (bun 1.2.21)
```

前置条件:CLI 需要 `bun` 在 PATH 中;Windows 下仓库路径**不能含空格**
(CLI 内部以未加引号的 `cre-compile.cmd` 路径调用 cmd,含空格会报 `'F:\AI' is not recognized ...`)。
该 hash 由编译工具链决定:bun 1.2.21 得到 `482ea06d…e31a`,bun 1.1.42 得到
`5d914691…c67a`(2026-10-02 两次独立复跑均稳定复现,同一 bun 版本下可重复)。
因此记录 hash 时务必同时记录 bun 版本。

已在 Windows/PowerShell 开发机使用 `npx -y bun@1.1.42` 调用本机安装的
`@chainlink/cre-sdk/bin/cre-compile.ts` 成功生成 WASM:

```powershell
cd workflows/compliance-lifecycle
npx -y bun@1.1.42 node_modules\@chainlink\cre-sdk\bin\cre-compile.ts main.ts dist\compliance-lifecycle.wasm --skip-type-checks
```

From the `zk-cid` workspace root, the same step is available as:

```powershell
yarn workspace compliance-lifecycle compile:cre
```

产物:

- `dist/compliance-lifecycle.js`(约 810 KB)
- `dist/compliance-lifecycle.wasm`(约 2.7 MB)
- Javy 编译器安装至 `C:\Users\Administrator\.cache\javy\v8.1.0\win32-x64\javy.exe`

`--skip-type-checks` 只跳过 CRE 编译器内部的 TS 检查;独立的
`tsc -p workflows/compliance-lifecycle/tsconfig.json` 已零错误通过,
两者共同覆盖“类型有效”和“可编译为 CRE Workflow WASM”。

## SDK 级端到端模拟(已实测通过)

本机虽然没有完整 CRE CLI,但 `@chainlink/cre-sdk@1.16.0` 自带
**TestRuntime**(`@chainlink/cre-sdk/test`),可在 Node/bun 进程内
用真实 Runtime + 能力 Mock 完整执行本工作流编排逻辑。已新增
`test/compliance-lifecycle.sim.test.ts`,3 条用例全部通过:

```powershell
# workspace 根目录
yarn workspace compliance-lifecycle test:sim
```

```text
bun test v1.1.42
test\compliance-lifecycle.sim.test.ts:
(pass) sanctions list has no overlap -> credentials stay valid (status ok, no writeReport)
(pass) sanctioned member intersects on-chain members -> CRE report + writeReport revokes it
(pass) sanctioned list has no on-chain match -> no writeReport (false positive guard)
 3 pass
 0 fail
```

模拟中实际执行的链路(与生产代码同一份 `core.ts`):

1. `HTTPClient.sendRequest(...)` -> `http-actions@1.0.0-alpha` 能力 Mock
   (返回与线上 mock-api 相同 JSON schema 的制裁名单)
2. `EVMClient.callContract(getMembers)` 与 `getLeaves()` ->
   `evm:ChainSelector:...@1.0.0` 能力 Mock(返回 ABI 编码成员/稳定叶子数组,
   与 Sepolia 合约状态一致)
3. 交集计算命中后按稳定 leaves 重建 Semaphore 树并生成真实 Merkle siblings,
   再调用 `runtime.report(prepareReportRequest(callData))`
   -> `consensus@1.0.0-alpha` 默认 Report 处理(产出 DON 签名报告)
4. `EVMClient.writeReport(...)` -> 能力 Mock 返回 `TX_STATUS_SUCCESS`
   与 txHash,日志输出 `revoked commitment=...`

> 定位说明:这是 **SDK 层 TypeScript 运行时模拟**,用能力 Mock 覆盖判定与
> 报告路径;它不能替代官方 CLI。官方 `cre workflow simulate` 的实测结果见
> 下一节(2026-10-02 已真实执行通过)。

## 官方 CRE CLI `workflow simulate` 实测结果(2026-10-02)

> 真实广播演练(含第一笔链上撤销交易与踩到的坑)单独记录在
> [`cre-broadcast-evidence.md`](./cre-broadcast-evidence.md)。

`cre workflow simulate` 已用官方 CLI v1.36.0 在本机真实执行,完整日志见
`cre-simulate-20261002-232950.log`(该次运行已把报告目标改为
`ComplianceGateReceiver` 适配器)。运行命令:

```powershell
cd zk-cid/workflows
.\run-cre-simulate.ps1     # 需要 cre login 或 CRE_API_KEY
```

关键输出(原始日志逐字摘录,未改写):

```text
  Binary hash: f0edfaa2f665a7321258ff069c0af6e9adf01611ff997ce376799e0dce9ac15c
  Config hash: d8f9534a03d44bd98eb6ef83d728aee28d4639d99b573ff0796a60d11802c096
[SIMULATION] Simulator Initialized
[SIMULATION] Running trigger trigger=cron-trigger@1.0.0
[USER LOG] sanctions list fetched: 1 entries (source=Mock OFAC SDN Sanctions List (Demo))
[USER LOG] on-chain members fetched: 1
[USER LOG] on-chain leaves fetched: 2 (1 active)
[USER LOG] merkle proof generated commitment=123456789012345678901234567890123456789 siblingCount=1
[USER LOG] revoked commitment=123456789012345678901234567890123456789
✓ Workflow Simulation Result:
"{\"status\": \"revoked\", \"revokedCount\": 1, \"revokedCommitments\": [\"1234…789\"],
  \"txHashes\": [\"\"], \"proofs\": [{\"commitment\": \"1234…789\", \"siblings\": [\"0\"]}],
  \"source\": \"Mock OFAC SDN Sanctions List (Demo)\", \"executedAt\": \"2026-10-02T15:30:52.254Z\"}"
│ Simulation complete! Ready to deploy your workflow?  │
```

这条链路是**真实执行**的:工作流经 DON 共识路径抓取线上制裁名单 API,用
`EVMClient.callContract` 读取 Sepolia 上 `getMembers()` / `getLeaves()`,用本地
LeanIMT + Poseidon(2) 重建 Semaphore 树生成 Merkle siblings,再经
`runtime.report()` 产出报告并走 `writeReport` 的撤销分支。`txHashes` 为空是
模拟语义(未加 `--broadcast`,不会真的发交易);`siblings` 为 `["0"]` 与链上
单成员树的真实结构一致。

### 为跑通 simulate 修复的三个真实缺陷

1. **`poseidon-lite` 依赖 `atob`,CRE WASM 运行时没有该全局** —— 只要 import
   就会在整个工作流启动时 `wasm trap: unreachable`。已改为:
   `@zk-kit/lean-imt`(Semaphore v4 同款树)+ 本地 `poseidon2-lite.ts`
   (内联 t=3 常量,自带 base64 解码),并用 `test/poseidon2-lite.test.ts`
   锁定与 `poseidon-lite` 的输出逐位一致(4 组向量,含大数)。
2. **工作流代码访问 `process.env`**,而 CRE WASM 运行时没有 `process` 全局 ——
   触发执行时报 `process is not defined`。已改为
   `typeof process !== "undefined" ? process.env : {}` 的防御式读取,
   生产值仍然来自 `config.json`。
3. **工作流目录里遗留的注释版 `project.yaml`** 会被 CLI 优先读取,导致
   `simulate` 报 `no RPC URLs found for target "staging-settings"`。
   已删除该文件,项目级配置只保留 `zk-cid/workflows/project.yaml`。

另外,bun 1.1.x 生成的 WASM 在 CRE 引擎里同样会 `wasm trap`;
本仓库的 `compile:cre` / `test:sim` 已改用 **bun 1.2.21**。

## 复现命令(评审者可在装有 CRE CLI 的环境执行)

```bash
# 1. 安装 CRE CLI(参考 https://docs.chain.link/cre)
#    macOS/Linux: brew install chainlink/cre/cre  或以官方安装脚本为准

# 2. 启动 Mock 制裁名单 API(项目根目录)
yarn workspace mock-api start        # 监听 http://localhost:3001

# 3. 类型检查 / 编译工作流
./node_modules/.bin/tsc -p workflows/compliance-lifecycle/tsconfig.json

# 4. 编译工作流(官方 CLI,无需登录)
cd zk-cid/workflows
cre workflow build compliance-lifecycle -T staging-settings

# 5. 运行 CRE 本地模拟(需要登录或 CRE_API_KEY)
cre login                       # 交互式;或设置环境变量 CRE_API_KEY=<key>
cre workflow simulate compliance-lifecycle -T staging-settings
```

预期行为:每个 cron 周期抓取制裁名单 -> 读取 `getMembers()`/`getLeaves()` ->
命中时通过 `writeReport` 调用 `revokeCredentialWithMerkleProof`,日志中出现
`revoked commitment=...`。

## 遗留风险

1. **writeReport 与本地链**:CRE 的写链路径(DON 签名报告 ->
   capability 递交交易)在纯本地 hardhat/anvil 链上的支持取决于
   CRE 本地模拟环境的链配置;若本地链不被 evm capability 支持,
   写链步骤可能需要在 Sepolia 等受支持测试网上验证。
2. **链选择器**:默认配置为 `ethereum-testnet-sepolia`;若目标合
   约部署在本地链,需要在 CRE 模拟环境中映射对应的链配置,
   `chainSelectorName` 必须能在 `getNetwork()` 中解析。
3. **Merkle siblings**:工作流已按合约的稳定 leaves 重建 Semaphore
   树并生成真实 siblings;Sepolia 实链验证中重建根与链上根一致,
   官方 CLI simulate 也已复现(见上文日志)。
4. **真实广播路径已落地,只差 CRE 网络部署权限**:`simulate` 未开启
   `--broadcast`,所以日志里没有真实交易。写链合约侧已按官方模式完成:
   `ComplianceGateReceiver`(`contracts/cre/`,官方 `ReceiverTemplate` 模式,
   只接受 Keystone forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
   的调用)已部署到 Sepolia `0xB5ad6413a16efd82b76212830f908B2D67C20425`,
   且 `ComplianceGate.creWorkflow` 已指向该适配器;报告 payload 为
   `abi.encode(uint256 commitment, uint256[] siblings)`。
   本地模拟的签名不会被生产 forwarder 接受,生产广播需要 CRE 网络部署权限。
   本组织(`org_Ny2pYrg6kUlxEU8h`)已于 2026-10-03 通过 `cre account access`
   提交带完整用途说明的申请,当前 `cre whoami` 显示
   `Deploy Access: Not enabled`(审核中);批准后执行
   `cre workflow deploy compliance-lifecycle -T production-settings` 即可,
   合约与工作流无需再改。

