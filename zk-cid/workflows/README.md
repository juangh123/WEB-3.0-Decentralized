# Chainlink CRE Workflow: Compliance Lifecycle

This directory contains the Chainlink CRE workflow that keeps the on-chain compliance group
in sync with an external sanctions feed and revokes listed credentials automatically. It is
written against the real `@chainlink/cre-sdk@1.16.0` API.

## Workflow overview

Two handlers share one screening pipeline (`compliance-lifecycle/core.ts`):

| Index | Trigger | Purpose |
| --- | --- | --- |
| 0 | `CronCapability` (`cron-trigger@1.0.0`), default `*/5 * * * *` | Continuous screening of every active member |
| 1 | EVM log trigger on `ComplianceGate.UserAdded(uint256 indexed commitment)`, `FINALIZED` confidence | Screening at issuance: only the newly issued commitment is checked |

Pipeline:

1. **HTTP**: every DON node fetches the sanctions list with `HTTPClient.sendRequest` in node
   mode; results must be identical (`consensusIdenticalAggregation`).
2. **EVM read**: `EVMClient.callContract` reads `getMembers()` and `getLeaves()` from
   `ComplianceGate` at the last finalized block.
3. **Compute**: intersect members with the list, rebuild the Semaphore tree from the stable
   leaves, and generate real Merkle siblings for each hit.
4. **EVM write**: each hit becomes a DON-signed report (`runtime.report(prepareReportRequest(...))`)
   delivered by `EVMClient.writeReport` to `ComplianceGateReceiver`, which calls
   `revokeCredentialWithMerkleProof` and removes the member from the Semaphore tree.

## Files

- `compliance-lifecycle/core.ts`: workflow logic and wiring (both handlers).
- `compliance-lifecycle/main.ts`: CRE Runner entry point.
- `compliance-lifecycle/config.json`: runtime config consumed via `runtime.config`
  (schedule, API URL, chain selector, gate and receiver addresses, gas limit,
  `screenOnIssuance`).
- `compliance-lifecycle/workflow.yaml`: workflow-level CRE CLI settings (official
  `staging-settings` / `production-settings` schema).
- `project.yaml`: project-level CRE CLI settings (RPC endpoints per target).
- `compliance-lifecycle/test/`: SDK TestRuntime simulation (11 workflow tests) and Poseidon
  compatibility vectors (3).
- `compliance-lifecycle/evidence/`: raw CLI logs, the broadcast rehearsal, and
  [the evidence summary](./compliance-lifecycle/evidence/README.md).
- `run-cre-simulate.ps1`: Windows helper that runs the official CLI from a space-free path
  and writes a timestamped log into `evidence/`.

## CRE CLI commands

```bash
cd zk-cid/workflows
cre workflow build compliance-lifecycle -T staging-settings
# cron handler (needs `cre login` / CRE_API_KEY)
cre workflow simulate compliance-lifecycle -T staging-settings --non-interactive --trigger-index 0
# issuance handler, replaying a real UserAdded log from Sepolia
cre workflow simulate compliance-lifecycle -T staging-settings --non-interactive --trigger-index 1 \
  --evm-tx-hash 0xc24471de9b752244089bb3818b9e7a2b61b3cf24691812ddd5b7685fd4fb3247 --evm-event-index 1
```

On Windows: `.\run-cre-simulate.ps1` (cron) or `.\run-cre-simulate.ps1 -Trigger issuance`.
The CLI needs `bun` on `PATH`, and on Windows the repository path must not contain spaces
(the CLI invokes `cre-compile.cmd` unquoted), which the helper script works around.
