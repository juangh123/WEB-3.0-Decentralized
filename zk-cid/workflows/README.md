# Chainlink CRE Workflow: Compliance Lifecycle

This directory contains the Chainlink CRE workflow that automates credential
revocation based on an external sanctions API, written against the real
`@chainlink/cre-sdk@1.16.0` API installed in the repo root.

## Workflow Overview

- **Trigger**: `CronCapability` (`cron-trigger@1.0.0`), schedule configurable
  via `config.json` (default: every 5 minutes, `*/5 * * * *`).
- **Entry**: `Runner.newRunner<Config>()` + `cre.handler(...)` in
  `compliance-lifecycle/main.ts`.
- **Step 1 (HTTP)**: Each DON node fetches the sanctions list from the Mock
  API via `HTTPClient.sendRequest` in node mode; results are agreed with
  `consensusIdenticalAggregation`.
- **Step 2 (EVM read)**: `EVMClient.callContract` reads `getMembers()` from
  the `ComplianceGate` contract at the last finalized block.
- **Step 3 (Compute)**: Intersect on-chain members with the sanctions list.
- **Step 4 (EVM write)**: For each hit, a DON-signed report is produced via
  `runtime.report(prepareReportRequest(...))` and submitted with
  `EVMClient.writeReport`, which calls `revokeCredential` on-chain.

## Files

- `compliance-lifecycle/main.ts` — workflow source (TypeScript, UTF-8).
- `compliance-lifecycle/config.json` — runtime config consumed via
  `runtime.config` (schedule, API URL, chain selector, contract address,
  gas limit).
- `compliance-lifecycle/workflow.yaml` — trigger and chain declaration for
  the CRE CLI.
- `compliance-lifecycle/dist/` — `tsc` build output.
- `compliance-lifecycle/evidence/README.md` — honest status, reproduction
  commands, and remaining risks. Simulation output is only added after an
  actual `cre workflow simulate` run on a machine with the CRE CLI.
