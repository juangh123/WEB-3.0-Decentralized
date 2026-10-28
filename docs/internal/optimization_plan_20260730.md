# ZK-CID 整体优化计划 (Optimization Plan)

> Status: APPROVED 
> Source: 依据 Brooks-Lint 静态代码健康扫描报告
> Mode: --deliberate (包含高风险核心智能合约的修改)
> Iterations: 1 / 1
> Author: Workflow Agent
> Last updated: 2026-07-30

## Requirements summary
本项目目前处于原型向生产级架构过渡阶段。根据前期的静态代码与架构健康度扫描，系统在智能合约 Gas 性能、前端架构整洁度以及核心逻辑测试覆盖保障上存在严重缺陷（总体评级 53/100）。本计划旨在通过外科手术式的改动，消除 O(N) 的线性死穴，剔除无效技术债，并修复危险的测试金字塔倒置问题。

## Acceptance criteria
- **AC-1 (性能与安全)**: `ComplianceGate.sol` 和 `MockSemaphore.sol` 中用于移除成员的核心逻辑，需从 O(N) 循环变更为 O(1) 的 Map/Set 组合索引机制。
- **AC-2 (架构解耦)**: 重构不可重用的 `ComplianceGate`，将 `onlyAccessNFT` 的写死认证重构为基于角色的通用校验 `hasRole(VERIFIER_ROLE)`。
- **AC-3 (前端减负)**: 删除标记为 Legacy 的陈旧页面（`app/issuer`, `app/user`, `app/verify`）及其遗留 Hook，消除知识重复（Knowledge Duplication）。
- **AC-4 (打破覆盖率错觉)**: 为 `packages/nextjs/hooks/zk-cid/useProof.ts` 与 `mock-api/api/sanctions-list.ts` 各自补充 1 套完善的单元测试。
- **AC-5 (系统级保护)**: 构建至少 1 个 Playwright 或 Cypress 基础端到端 (E2E) 脚本测试 `身份下发 -> Mint ZK-NFT` 全流程。

## RALPLAN-DR

### Principles
- **最小代码 (Minimalism)**: 删除大片冗余文件；不在不必要的范围盲目引入沉重的类库。
- **降本增效 (Gas Optimization)**: 在 Web3 环境中，性能（Gas）就是资金。不可扩展的循环将招致必然的 DoS 攻击。
- **测试为翼 (Test Driven Validation)**: 没有测试的加密逻辑等同于灾难。

### Decision drivers
- 智能合约安全性与上限健壮性
- 代码的长期可维护性与认知减负
- 端到端功能完整性闭环验证

### Viable options
**Option A（推荐）: 原生极简 Mapping 索引替换 + 最小化角色的解耦**
- 智能合约修改：在原合约里手动维护 `mapping` 索引来淘汰数组拉链循环；采用极权模式的单所有权分离（Ownable）来分发受限验证权限，避免引入臃肿的 `AccessControl` 合约。
- 瘦身前端：强制物理删除遗产代码页面和独立 Hook。
- 测试集成：Vitest 覆盖 TS Hook 和 API 层面，引入 Playwright 进行自动化 E2E 检查。
- Pros: Gas 开销极低，修改精细且不影响原测试上下文，合约改动能限制在几个方法内。
- Cons: 需要手动处理映射表逻辑带来的状态同步风险（在 `add` 与 `revoke` 之间保证游标及索引状态准确）。

**Option B: 接入 OpenZeppelin EnumerableSet 及大重构**
- 智能合约修改：彻底采用 OpenZeppelin 的 `EnumerableSet` 类型接管 `groups` 与 `members`；并引入带所有层级控制的完整 `AccessControl` 基础设施。
- 其他与 Option A 一致。
- Pros: 成熟稳定，不易编写错逻辑。
- Cons: 显著增加了合约体积，增加了 `AccessControl` 的包袱可能会影响到原有的简单结构部署流程和用例；改动范围会波及其它没有问题的模块（扩散性改动）。

## ADR (Architecture Decision Record)

- **Decision**: 采用 **Option A** 方案进行重构。
- **Drivers**: 智能合约上限健壮性与最小化变动（最小代码原则）。
- **Alternatives considered**: Option B 被否决（Rejected）。虽然它提供了业界标准库支持，但大幅增加的合约体积与 `AccessControl` 权限模型的重整违背了“外科手术式”精细改动原则。
- **Why chosen**: 手动维护映射表删除与基于已有的简单所有者/极简修饰符，不但能解决 O(N) 这颗毒瘤问题，还可以使合约逻辑清晰可读而不膨胀组件体积，维持原本极小的依赖树。
- **Consequences**:
  - 正：在零增加外部依赖的情况下，突破成员容纳瓶颈；精简项目提升可维护性；增强联调测试底蕴。
  - 负：需要仔细书写映射更新逻辑防止状态错误；增加了编写新集成测试的初次搭建成本。
- **Follow-ups**: 在后续大版本更新中，可以利用 The Graph 建设完善的事件驱动后端，剥离依靠链上查表获取当前活跃成员集的依赖。

## Implementation steps

1. **改造 `ComplianceGate.sol` (智能合约层)**
   - `packages/hardhat/contracts/ComplianceGate.sol`: 
     - 将原数组加全局 `mapping(uint256 => uint256) public memberIndices;`。
     - 改写 `revokeCredential()`：改用 mapping 的 O(1) 查找并将尾部元素复制到此后 `pop`（O(1) 删除模式）。
     - 将 `onlyAccessNFT` 改为基于授权角色数组或简单的所有权委托，允许其调用 `verifyCompliance`。
2. **改造 `MockSemaphore.sol` (智能合约层)**
   - `packages/hardhat/contracts/MockSemaphore.sol`: 同样应用尾部交换删除法更新 `removeMember`，并修补随之产生关联的 `updateMember`。
3. **清理僵尸代码 (前端层)**
   - 删除 `packages/nextjs/app/issuer/page.tsx`
   - 删除 `packages/nextjs/app/user/page.tsx`
   - 删除 `packages/nextjs/app/verify/page.tsx`
   - 如果 `../../hooks/useIdentity.ts` 仅是被废弃页面引用，亦对其进行安全删除。
4. **补充核心业务单元测试 (前端与后台 API)**
   - 在 `packages/nextjs/hooks/zk-cid/` 初始化配套的 `useProof.test.ts` (基于 Vitest) 覆盖零知识参数生成的入参与边界。
   - 在 `mock-api/api/` 创建 `sanctions-list.test.ts` 确保在无 Cache 状态下 API 返回标准的视图形式。
5. **部署系统 E2E 测试链路**
   - 初始化基础配置：配置 Playwright 启动前端的本地实例 (`http://localhost:3000`) 与 Mock-API (`http://localhost:3001`)。
   - `e2e/zk-cid-flow.spec.ts`: 模拟创建身份 -> 发证成功 -> 验证生成 Proof 并弹窗成功的断言流程。

## Workspace setup
- 实施前必须运行 `git status --short` 和 `git branch --show-current`。
- 因为本 Plan 会深入核心智能合约且增加多个新测试包，实施前应新建干净的工作树：推荐使用 `git checkout -b codex/refactor-health` 进行保护，严禁在 dirty 树中合并以上变动。

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| 映射索引在尾部删除时覆盖不全，导致合约数据产生幽灵数据 (Ghost Read) | 严格运用 O(1) Swappable Deletion 的经典写法，在更新测试用例中刻意覆盖“删除第一个”、“删除最后一个”的特殊边缘逻辑，并在此过程中确保数组元素正确递减。 |
| 解除 `onlyAccessNFT` 耦合后，如何鉴权调用者？ | 保留原有的注册流，增加 `setVerifier(address _verifier, bool _status)` 由 Owner 控制认证网关名单，防止不信任的应用滥用验证资源。 |
| 删除 Legacy UI 后可能存在其他组件遗留的悬挂路由 | 全局搜索这三个路由字符串：`/issuer`,`/user`,`/verify`，并删除 NavBar 或者其他引用组件上的入口链接。 |

## Pre-mortem (Deliberate Mode)
1. **Scenario**: 合约修改完成部署到重置的本地测试网后，调用 `revokeCredential` 时发生越界或 Revert（例如 `index out of bounds`）。
   **Trigger**: 删除映射最后一条记录并且数组为空时的状态指针更新没有对齐逻辑边界。
   **Mitigation**: 修改完成后的第一手操作是针对 `remove` 与 `revoke` 各补充 1 个 Hardhat 底层 Unit Test 断言“将唯一用户撤销后数组为空但不抛出错误”。
2. **Scenario**: Playwright E2E 测试因 Wagmi 或 WalletConnect Web3 钩子弹窗未命中而挂起超时（Timeout）。
   **Trigger**: Wagmi 的浏览器模拟支持需要特殊补丁，而真实的扩展钱包很难通过标准的 Click 触发连接。
   **Mitigation**: 使用 `Mock Connector` (如 scaffold-eth-2 推荐支持的 Burner Wallet) 来承载 E2E 环境下快速签名及交易测试，并在 E2E 前置钩子中绕过 MetaMask 加载环境。
3. **Scenario**: 删除 Legacy 页面后 Next.js 抛出 `Module not found` 并阻断编译 (Build Blocked)。
   **Trigger**: 项目深处残留了将过早抽象的组件直接链接至旧页面的引用逻辑。
   **Mitigation**: 严格在修改完成后，执行完整的 `yarn lint` 和 `yarn build` 命令（而非仅仅看 `dev` 下的反应）来保障文件拓扑连贯；随时使用全局 Grep 工具扫除旧依赖痕迹。

## Expanded test plan (Deliberate Mode)
- **Unit**: 修改 Hardhat 合约相关的断言以兼容并保护 O(1) 尾部交换操作；对于所有 `mock-api` 和涉及 ZK 的 `hooks` 书写断路与分支测试以打破 Coverage Illusion。
- **Integration**: 需要保证前端页面、Smart Contract 的联调部署流程不会因依赖包升级而断裂，本地的 `yarn start` 和 `yarn chain` 需要在全套更新后顺滑运行。
- **E2E**: 运用独立于业务逻辑外部框架（Playwright）执行用户真实的交互之旅（Journey test），覆盖 ZK Proof 生成及其网络交互的回退机制。
- **Observability**: 合约端发射了重要的事件（如 `CredentialRevoked`，`MemberUpdated`），我们需要在前端或监控端上，配置可以监听该事件的主动流来替换被动触发轮询的情况。

## Verification steps
- AC-1 验证：在 Hardhat Shell 执行模拟插入 1000 个凭据列表，并测量调用撤销功能所消耗的 gas，确认为常数级。
- AC-2 验证：通过 Hardhat 脚本用授权过和未授权的不同地址访问 `verifyCompliance`，未授权地址被精准回退而合规者安全通过。
- AC-3 验证：运行 `yarn build` （针对 nextjs 模块），保证删除后完全不影响其编译周期，并在全局不留含 `legacy` 页面的文字记录。
- AC-4 验证：调用 `vitest` / 或 `jest`，`mock-api/api/sanctions-list` 返回状态应为 `PASS` 并且 coverage 不低于 90%。
- AC-5 验证：使用 `npx playwright test` 并确认该命令在终端退出码为 0，并且最终能输出通过“证明成功”画面的截图及结果记录。
