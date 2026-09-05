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
2. `EVMClient.callContract(getMembers)` -> `evm:ChainSelector:...@1.0.0`
   能力 Mock(返回 ABI 编码成员数组,与 Sepolia `getMembers()` 一致)
3. 交集计算命中后 `runtime.report(prepareReportRequest(callData))`
   -> `consensus@1.0.0-alpha` 默认 Report 处理(产出 DON 签名报告)
4. `EVMClient.writeReport(...)` -> 能力 Mock 返回 `TX_STATUS_SUCCESS`
   与 txHash,日志输出 `revoked commitment=...`

> 定位说明:这是 **SDK 层 TypeScript 运行时模拟**,证明工作流编排逻辑
> 可端到端执行、判定与报告/上链路径正确;它不等同于完整 CRE CLI 的
> `cre workflow simulate`(DON 网络级仿真),后者仍需评审者在装有
> CRE CLI 的环境复现,命令见下文。

## 未实测项(保留的诚实边界)

完整 CRE CLI(`cre` 命令)仍未安装,`cre workflow simulate` 的
DON 网络级仿真 **尚未执行**;此目录不放任何伪造的 CLI 模拟输出。
SDK 级模拟(上文)已实际运行并通过,两者边界明确、无夸大。

## 复现命令(评审者可在装有 CRE CLI 的环境执行)

```bash
# 1. 安装 CRE CLI(参考 https://docs.chain.link/cre)
#    macOS/Linux: brew install chainlink/cre/cre  或以官方安装脚本为准

# 2. 启动 Mock 制裁名单 API(项目根目录)
yarn workspace mock-api start        # 监听 http://localhost:3001

# 3. 类型检查 / 编译工作流
./node_modules/.bin/tsc -p workflows/compliance-lifecycle/tsconfig.json

# 4. 运行 CRE 本地模拟(在工作流目录下)
cd workflows/compliance-lifecycle
cre workflow simulate .
```

预期行为:每个 cron 周期抓取制裁名单 -> 读取 `getMembers()` ->
命中时通过 `writeReport` 调用 `revokeCredential`,日志中出现
`revoked commitment=...`。

## 遗留风险

1. **writeReport 与本地链**:CRE 的写链路径(DON 签名报告 ->
   capability 递交交易)在纯本地 hardhat/anvil 链上的支持取决于
   CRE 本地模拟环境的链配置;若本地链不被 evm capability 支持,
   写链步骤可能需要在 Sepolia 等受支持测试网上验证。
2. **链选择器**:默认配置为 `ethereum-testnet-sepolia`;若目标合
   约部署在本地链,需要在 CRE 模拟环境中映射对应的链配置,
   `chainSelectorName` 必须能在 `getNetwork()` 中解析。
3. **Merkle siblings**:撤销调用传空数组(合约已知限制,以
   `hasBeenRevoked` 标记作为执行依据),生产环境需接入 Merkle
   索引器。

