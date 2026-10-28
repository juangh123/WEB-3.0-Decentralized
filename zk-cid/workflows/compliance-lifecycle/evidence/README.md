# Evidence: the `compliance-lifecycle` Chainlink CRE workflow

This folder holds the raw evidence that the workflow builds, simulates and writes on-chain.
Every claim below links to a log file in this folder, a test in this repository, or a
Sepolia transaction, so nothing has to be taken on trust.

## At a glance

| Claim | Evidence | Status |
| --- | --- | --- |
| Official CRE CLI v1.36.0 builds the workflow | [`cre-simulate-20261002-192709.log`](./cre-simulate-20261002-192709.log) (build-only run) | ✅ 2026-10-02 |
| `cre workflow simulate` runs the cron handler end to end against live Sepolia state | [`cre-simulate-20261002-232950.log`](./cre-simulate-20261002-232950.log) | ✅ 2026-10-02 |
| A CRE report produced a real on-chain revocation | Sepolia tx [`0xb64c050e…`](https://eth-sepolia.blockscout.com/tx/0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9), details in [`cre-broadcast-evidence.md`](./cre-broadcast-evidence.md) | ✅ 2026-10-02 |
| Production write path: `ComplianceGateReceiver` (official `ReceiverTemplate` pattern) | [Verified source on Blockscout](https://eth-sepolia.blockscout.com/address/0xB5ad6413a16efd82b76212830f908B2D67C20425#code); 7 contract tests | ✅ deployed |
| Issuance handler (EVM log trigger on `UserAdded`) | 5 TestRuntime tests; compiles to WASM with `cre-compile`; CLI replay command below | ✅ tests · CLI replay: run `.\run-cre-simulate.ps1 -Trigger issuance` |
| SDK-level end-to-end simulation | `yarn workspace compliance-lifecycle test:sim`: 11 workflow tests + 3 Poseidon vectors | ✅ CI |
| Continuous execution on the Chainlink DON | Deploy access requested 2026-10-03 (`cre account access`) | ⏳ commercial onboarding step (call + MNDA) |

## What the workflow does

`core.ts` uses only the real `@chainlink/cre-sdk@1.16.0` API (checked against the type
declarations in `node_modules/@chainlink/cre-sdk/dist/`):

| Step | SDK API |
| --- | --- |
| Triggers | `new CronCapability().trigger({ schedule })` and `new EVMClient(selector).logTrigger(logTriggerConfig({ addresses, topics, confidence: "FINALIZED" }))` |
| Wiring | `cre.handler(trigger, fn)` + `Runner.newRunner<Config>()` (`main.ts`) |
| Fetch sanctions list | `HTTPClient.sendRequest(runtime, fn, consensusIdenticalAggregation<string>())`: every DON node fetches, results must be identical |
| Read chain state | `EVMClient.callContract(runtime, { call: encodeCallMsg(...), blockNumber: LAST_FINALIZED_BLOCK_NUMBER })` for `getMembers()` and `getLeaves()` |
| Build the removal proof | Local LeanIMT + Poseidon(2) rebuilds the exact Semaphore tree from the stable leaves and produces real Merkle siblings |
| Write | `runtime.report(prepareReportRequest(payload))` produces a DON-signed report; `EVMClient.writeReport(runtime, { receiver, report, gasConfig })` delivers it to `ComplianceGateReceiver`, which calls `ComplianceGate.revokeCredentialWithMerkleProof` |
| Config | Everything comes from `runtime.config` (`config.json`); no hard-coded addresses or URLs |

### Handlers and `--trigger-index`

| Index | Trigger | What it screens | Why |
| --- | --- | --- | --- |
| 0 | Cron (`*/5 * * * *`) | Every active member | Catches designations made after onboarding |
| 1 | EVM log, `ComplianceGate.UserAdded(uint256 indexed commitment)`, `FINALIZED` | Only the newly issued commitment | Screening at issuance: a listed identity is revoked without waiting for the next cron tick |

The log trigger waits for finality on purpose: the workflow reads the gate at the last
finalized block, so reacting to an unfinalized log would build the Merkle proof against a
tree that does not contain the new leaf yet (the exact failure documented in
`cre-broadcast-evidence.md`, caveat 3). An issuance run that sees a listed commitment which
is not yet an active member returns `status: "skipped"`, and the cron handler picks it up.

## Official CLI simulation (cron handler, 2026-10-02)

Command (from `zk-cid/workflows`, needs `cre login` or `CRE_API_KEY`):

```powershell
.\run-cre-simulate.ps1
```

Key lines from the raw log, unedited:

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
```

This run was real: the DON-consensus path fetched the live sanctions API, `callContract`
read `getMembers()` / `getLeaves()` from Sepolia, the Semaphore tree was rebuilt with real
siblings, and the report went down the `writeReport` revoke branch. `txHashes` is empty
because `simulate` does not broadcast unless `--broadcast` is set; `siblings: ["0"]` matches
the single-member tree that was live at the time.

The binary and config hashes change whenever the code or `config.json` changes (they also
depend on the bun version used by `cre-compile`), so a fresh run prints different hashes.

## Replaying a real issuance through the log trigger

The issuance handler can be replayed against a real Sepolia transaction. The default is the
issuance of the live demo commitment,
[`0xc24471de…3247`](https://eth-sepolia.blockscout.com/tx/0xc24471de9b752244089bb3818b9e7a2b61b3cf24691812ddd5b7685fd4fb3247),
where `UserAdded` is log index 1 inside the transaction (index 0 is Semaphore's
`MemberAdded`):

```powershell
.\run-cre-simulate.ps1 -Trigger issuance
# = cre workflow simulate compliance-lifecycle -T staging-settings --non-interactive `
#     --trigger-index 1 --evm-tx-hash 0xc24471de9b752244089bb3818b9e7a2b61b3cf24691812ddd5b7685fd4fb3247 `
#     --evm-event-index 1
```

Because that commitment is on the demo sanctions list and still a member, the expected
result is `status: "revoked"` with `trigger: "issuance"` (a dry run: nothing is broadcast).
The log is written to `cre-simulate-issuance-<timestamp>.log` in this folder.

## Three real defects found by running `simulate`

1. **`poseidon-lite` needs the browser global `atob`, which the CRE WASM runtime lacks.**
   Importing it trapped the workflow at engine start (`wasm trap: unreachable`). Replaced by
   `@zk-kit/lean-imt` (the tree Semaphore v4 uses) plus a local `poseidon2-lite.ts` with
   inlined constants; `test/poseidon2-lite.test.ts` pins it to `poseidon-lite` bit for bit.
2. **The workflow read `process.env`, and the CRE WASM runtime has no `process` global**
   (`process is not defined`). Overrides are now read defensively; production values always
   come from `config.json`.
3. **A stale comment-only `project.yaml` inside the workflow folder** shadowed the real
   project settings, so `simulate` reported `no RPC URLs found for target "staging-settings"`.
   Removed; the only project settings file is `zk-cid/workflows/project.yaml`.

Also: WASM produced by bun 1.1.x traps in the CRE engine, so `compile:cre` and `test:sim`
pin bun 1.2.21.

## SDK-level simulation (no CRE CLI needed)

`@chainlink/cre-sdk/test` ships a `TestRuntime` that executes the production `core.ts` with
capability mocks for HTTP and EVM:

```bash
yarn workspace compliance-lifecycle test:sim
```

Covered paths (`test/compliance-lifecycle.sim.test.ts`):

- no overlap → `ok`, no write; overlap → DON report + `writeReport` revokes with the right
  Merkle siblings; listed commitment with no on-chain match → no write (false-positive guard)
- batch of hits → state is re-read between writes so every member is revoked
- malformed feed entries are skipped and reported instead of aborting the run
- a reverted write is reported as `partial`, never as success
- issuance handler: clean commitment → `clear` with no EVM calls; listed commitment →
  revoked immediately while other members are left to cron; not yet finalized → `skipped`;
  logs from another contract, another event, or a reorg → `ignored` before any capability
  call; `initWorkflow` registers cron at index 0 and the log trigger at index 1

This is a TypeScript runtime simulation with mocked capabilities; it complements, and does
not replace, the official `cre workflow simulate` runs above.

## Compile and reproduce

```bash
# type check
yarn workspace compliance-lifecycle compile
# compile to CRE WASM with the SDK's own compiler (bun 1.2.21 + Javy)
yarn workspace compliance-lifecycle compile:cre      # -> dist/compliance-lifecycle.wasm (~2.7 MB)

# official CLI (needs bun on PATH; `simulate` needs `cre login` or CRE_API_KEY)
cd zk-cid/workflows
cre workflow build compliance-lifecycle -T staging-settings
cre workflow simulate compliance-lifecycle -T staging-settings --non-interactive --trigger-index 0
```

On Windows the CLI cannot run from a path that contains spaces (it calls `cre-compile.cmd`
unquoted). `run-cre-simulate.ps1` mirrors the workflow to a space-free folder first and
writes every run to a timestamped log here. `-BuildOnly` skips `simulate`.

## Boundaries

- **No DON deployment yet.** Local signatures are not accepted by the production Keystone
  forwarder, so a scheduled on-chain run needs CRE network deploy access. The request was
  filed on 2026-10-03 (org `org_Ny2pYrg6kUlxEU8h`). Chainlink confirmed local simulation is
  fully supported and that testnet/mainnet DON deployment follows a commercial call and an
  MNDA. After that, `cre workflow deploy compliance-lifecycle -T production-settings` needs
  no contract or workflow changes.
- **The broadcast rehearsal used the MockKeystoneForwarder**, whose `report()` skips
  signature checks; the adapter was switched back to the production forwarder afterwards.
  See `cre-broadcast-evidence.md` for the transactions and caveats.
- **The receiver does not pin a workflow owner or ID yet.** It only accepts the Keystone
  forwarder, and the deployment script refuses to create an unpinned receiver; the live one
  must be pinned with `setExpectedAuthor` / `setExpectedWorkflowName` once the deploying
  owner address is known.
- **The sanctions feed is a mock** (in-memory, single source). Production needs a licensed,
  versioned feed and human review of matches.

A Chinese copy of the earlier notes is kept in [`README.zh-CN.md`](./README.zh-CN.md).
