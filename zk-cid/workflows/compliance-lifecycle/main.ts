/**
 * ZK-CID compliance-lifecycle workflow: CRE Runner entry point.
 *
 * Business logic lives in core.ts (runComplianceCheck / initWorkflow). This file only wires
 * the CRE Runner, so the WASM compile entry and the test entry stay independent.
 *
 * Written against the real type declarations of the installed @chainlink/cre-sdk@1.16.0
 * (dist/sdk/cre, dist/sdk/runtime, dist/generated-sdk/.../client_sdk_gen).
 */
import { Runner } from "@chainlink/cre-sdk";
import { initWorkflow, type Config } from "./core";

/** CRE Runner entry point. */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main().catch((error) => {
  console.error("compliance-lifecycle runner failed:", error);
  process.exit(1);
});
