/**
 * ZK-CID 合规生命周期工作流(CRE Runner 入口)
 *
 * 业务逻辑见 core.ts(runComplianceCheck / initWorkflow),此处仅负责
 * 装配 CRE Runner,保证 WASM 编译入口与测试驱动入口互相独立。
 *
 * 本文件严格基于本机已安装的 @chainlink/cre-sdk@1.16.0 真实类型声明
 * (dist/sdk/cre、dist/sdk/runtime、dist/generated-sdk/.../client_sdk_gen)编写,
 * 不再使用任何虚构的 ctx.capabilities.* API。
 */
import { Runner } from "@chainlink/cre-sdk";
import { initWorkflow, type Config } from "./core";

/** CRE Runner 入口 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
