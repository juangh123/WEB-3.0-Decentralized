# Real on-chain broadcast evidence (2026-10-02)

This file records the first **real transaction produced by the CRE workflow**,
including the caveats we hit, so nobody has to trust a screenshot.

## What was run

```powershell
# the adapter temporarily trusts the Sepolia MockKeystoneForwarder, because a
# local simulation cannot produce signatures the production forwarder accepts
cd zk-cid/packages/hardhat
.\node_modules\.bin\tsx.cmd scripts\switchReceiverForwarder.ts mock

$env:CRE_ETH_PRIVATE_KEY = "<deployer key>"   # pays gas for the broadcast tx
cd ../workflows
cre workflow simulate compliance-lifecycle -T staging-settings `
  --non-interactive --trigger-index 0 --broadcast
```

Prerequisite: the demo commitment was a member of `ComplianceGate`
(`getMembers() = ["1234…789"]`) and the sanctions list flagged it.

## Result: a real revocation transaction

| Item | Value |
| --- | --- |
| Broadcast tx | `0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9` |
| Sent to | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` (MockKeystoneForwarder) |
| Status / gas | success, 228,085 gas, block 11829983 |
| Workflow result | `{"status":"revoked","revokedCount":1,"txHashes":["0xb64c050e…"]}` |

On-chain state after the broadcast (read back with
`tsx scripts/sepoliaSmokeDemo.ts status`):

```text
creWorkflow: 0xB5ad6413a16efd82b76212830f908B2D67C20425
members: []
isMember(demo): false
hasBeenRevoked(demo): true
```

So the DON-consensus workflow fetched the sanctions list, read the Sepolia
`getMembers()`/`getLeaves()`, rebuilt the Semaphore tree, produced the report,
and the revocation really landed on-chain — the member is gone from the
on-chain Semaphore tree.

## Caveats (important, and why they are documented here)

1. **This used the mock forwarder, not a CRE-network deployment.** The adapter
   was temporarily pointed at `MockKeystoneForwarder`
   (`0x15fC6ae953E024d975e77382eEeC56A9101f9F88`), whose `report()` skips
   signature validation. After the test the adapter was switched back to the
   production Keystone forwarder (`0xF8344CFd5c43616a4366C34E3EEE75af79a74482`),
   transaction `0x70f56b5a4e97213a86e051e8bac74cde78f07ecc27d40b50803a7cab00ce02f0`.
   A production broadcast still requires CRE-network deployment access
   (`cre account access`).
2. **MockKeystoneForwarder swallows receiver reverts.** Its `route()` uses a low
   level `call` and returns a bool, so a failed `onReport` still produces a
   *successful* outer transaction. Always verify the resulting contract state —
   a green tx hash alone proves nothing.
3. **The workflow reads at `LAST_FINALIZED_BLOCK_NUMBER`.** A credential that was
   re-issued only minutes earlier is not yet visible at the finalized block, so
   the Merkle proof is built for an older tree and the `removeMember` call
   reverts. We hit exactly this on a second attempt
   (`0x3a435e029d58d08226974705f0d322e24c0a513933937c84810949f4f674534e`,
   logged in `cre-broadcast-20261002-235028.log`): the outer tx succeeded but the
   state did not change. In production the cron interval (5 minutes) plus
   finality is normally enough, but any re-issue should be given time to
   finalize before the next workflow run.
