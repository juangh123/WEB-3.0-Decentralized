# Sepolia Real-Environment Deployment

This document records the live Sepolia deployment and the exact commands used to reproduce it.

## Deployed Contracts

| Contract | Address | Deployment Transaction |
| --- | --- | --- |
| ComplianceGate v2.2 | `0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70` | `0xfe593613bab81860bdddc54e3dde59d16b97ad8c83f2620a1dd587360b858635` |
| AccessNFT | `0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32` | `0x066fd2f47ec73da2bb42cee93713730fd762de4e7fc7668986d06015bc7fd5c0` |
| ComplianceGateReceiver (CRE write path) | `0xB5ad6413a16efd82b76212830f908B2D67C20425` | `0x01cc9b0ea19bcab37af0cd0960d940a50965b1801ab4eea72fed92c0f6e48020` |

External dependency:

| Dependency | Sepolia Address |
| --- | --- |
| Semaphore v4 | `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D` |

Deployer:

`0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348`

## Verified Source Code

Both contracts are source-verified (2026-10-02) on Blockscout and Sourcify, so
reviewers can read the exact deployed code without trusting this repository:

| Contract | Blockscout | Sourcify |
| --- | --- | --- |
| ComplianceGate | https://eth-sepolia.blockscout.com/address/0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70#code | https://sourcify.dev/server/repo-ui/11155111/0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70 |
| AccessNFT | https://eth-sepolia.blockscout.com/address/0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32#code | https://sourcify.dev/server/repo-ui/11155111/0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32 |

Reproduce the verification (no Etherscan API key required; the Blockscout and
Sourcify verifiers are built into `hardhat-verify` v3):

```powershell
cd zk-cid
yarn workspace @se-2/hardhat hardhat-verify --network sepolia `
  0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70 0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D
yarn workspace @se-2/hardhat hardhat-verify --network sepolia `
  0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32 0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70
yarn workspace @se-2/hardhat hardhat-verify --network sepolia `
  0xB5ad6413a16efd82b76212830f908B2D67C20425 0xF8344CFd5c43616a4366C34E3EEE75af79a74482 0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70
```

All three contracts are verified on Blockscout and Sourcify.

Etherscan Sepolia still shows "Verify and Publish" because that explorer needs a
separate `ETHERSCAN_API_KEY`; set one and run
`yarn verify --network sepolia etherscan` to cover that explorer too.

## CRE Write Path (real broadcast wiring)

The original `ComplianceGate` predates CRE: its `creWorkflow` slot only accepts
an EOA, so a DON-signed report could never reach it. Instead of redeploying the
verified gate (which would change its address and invalidate the whole evidence
chain), the write path is a separate adapter:

```
CRE workflow --writeReport--> Chainlink KeystoneForwarder
            --> ComplianceGateReceiver.onReport(metadata, report)
            --> ComplianceGate.revokeCredentialWithMerkleProof(commitment, siblings)
```

| Setting | Value |
| --- | --- |
| Keystone forwarder (Sepolia) | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| Adapter owner | `0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348` |
| `ComplianceGate.creWorkflow` | `0xB5ad6413a16efd82b76212830f908B2D67C20425` (the adapter) |
| Report payload | `abi.encode(uint256 commitment, uint256[] merkleProofSiblings)` |

Wiring transaction (`setWorkflow`):
`0xfcc7ce701d7fdbcca9f21b0987f4db0271198e027a5af5e0f2c3d1fc7101b8cc`

Reproduce the local proof (adapter → gate revocation, forwarder-only access):

```powershell
cd zk-cid
yarn hardhat:test        # includes 7 ComplianceGateReceiver tests
```

The remaining step for a production DON broadcast is CRE-network deployment
access. The organization (`org_Ny2pYrg6kUlxEU8h`) submitted the access request on
2026-10-03 through `cre account access` with this use case:

> ZK-CID (hackathon project, DoraHacks BLI Legal Tech Hackathon 2 / Chainlink
> Best Workflow with CRE bounty): a cron-triggered compliance workflow that
> fetches an external sanctions list over HTTP with DON consensus, reads
> Semaphore compliance-group membership from our Sepolia ComplianceGate
> contract, rebuilds the Merkle tree, and writes a revocation report to our
> ComplianceGateReceiver adapter which calls
> `revokeCredentialWithMerkleProof` on-chain.

`cre whoami` currently reports `Deploy Access: Not enabled` (request pending).
Local simulation cannot produce signatures the production forwarder accepts, so
once Chainlink approves the request the remaining command is:

```powershell
cd zk-cid/workflows
cre workflow deploy compliance-lifecycle -T production-settings
```

No contract or workflow changes are needed for that step — the receiver adapter,
forwarder allow-list and report payload are already wired and tested.

### Broadcast rehearsal (real transaction)

A rehearsal with `--broadcast` produced a real revocation:

| Item | Value |
| --- | --- |
| Broadcast tx | `0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9` |
| Effect | `getMembers()` went from one member to none; `hasBeenRevoked(commitment) = true` |

For the rehearsal the adapter temporarily trusted the Sepolia
`MockKeystoneForwarder` (whose `report()` skips signature checks) and was then
switched back to the production forwarder in transaction
`0x70f56b5a4e97213a86e051e8bac74cde78f07ecc27d40b50803a7cab00ce02f0`.
Two caveats are worth knowing before repeating it — the mock forwarder swallows
receiver reverts (always verify state, not just the tx hash), and the workflow
reads at the last finalized block, so a freshly re-issued credential is not yet
visible. Details:
`workflows/compliance-lifecycle/evidence/cre-broadcast-evidence.md`.

## Required Environment

Create `packages/hardhat/.env`:

```ini
ALCHEMY_API_KEY=your-alchemy-sepolia-key
DEPLOYER_PRIVATE_KEY=0x-your-funded-sepolia-private-key
ETHERSCAN_API_KEY=your-etherscan-key # optional, for verification
```

Never commit `.env` or the private key.

## Deploy

From the repository root:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
.\node_modules\.bin\tsx.cmd scripts\deploySepolia.ts
```

From the root package after the script is configured:

```powershell
yarn.cmd deploy:sepolia
```

The script deploys `ComplianceGate` and `AccessNFT`, then calls:

- `setAccessNFT(AccessNFT)`
- `setVerifier(AccessNFT, true)`
- `setWorkflow(deployer)`

## Update Frontend Contract Data

After deployment:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
.\node_modules\.bin\tsx.cmd scripts\generateTsAbis.ts
```

Then build the frontend:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid"
yarn.cmd workspace @se-2/nextjs build
```

## Smoke Test Evidence

Reproduce the live smoke test with the issuer wallet:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\hardhat"
$env:DEPLOYER_PRIVATE_KEY = "<issuer-private-key>"
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts status
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts issue
```

The `revoke` action now builds the Merkle siblings from `getLeaves()` and calls
`revokeCredentialWithMerkleProof`. Use a temporary commitment when reproducing
the tree-removal step, and keep the live demo commitment issued.

### Restoring the demo state

The live mock sanctions list currently flags the same commitment that is a
member on-chain, so the moment a real CRE workflow (or a live DON deployment)
executes, it legitimately revokes the demo credential and the `/zk-cid` page
will show `链上成员数 0`. That is the intended behaviour, not a bug. Restore the
demo in one command with the issuer wallet:

```powershell
cd zk-cid/packages/hardhat
$env:DEPLOYER_PRIVATE_KEY = "<issuer-private-key>"
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts status   # inspect current state
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts issue    # re-issue the demo commitment
```

Alternatively, point the mock API at a different commitment
(`SEED_SANCTIONED` on the mock-api Vercel project) so the live demo credential
stays valid while a temporary commitment demonstrates the revocation path.

| Step | Transaction |
| --- | --- |
| Issue live demo credential | `0x37e37f2a3cba81d6327bbfe0e7565649a51115771f0a1ad329ba788deef51dcf` |
| Issue temporary tree-test credential | `0xe06ef14d4183a19fcd03d6269f2701839ef2ac809928b223244ee41d32f9adfa` |
| Revoke temporary credential from tree | `0x8f0cb9341d4cf108101fb07a835c334c39f23ca9994bb26acc4497ee9e829ee0` |

Current live demo state after re-issuing a fresh commitment:

- Commitment: `123456789012345678901234567890123456789`
- Issue credential tx: `0x37e37f2a3cba81d6327bbfe0e7565649a51115771f0a1ad329ba788deef51dcf`

Verified state:

- `ComplianceGate.groupId = 712`
- `ComplianceGate.demoMode = true`
- `ComplianceGate.getMembers() = [123456789012345678901234567890123456789]`
- `ComplianceGate.getLeaves() = [123456789012345678901234567890123456789, 0]`
- Rebuilt Semaphore root equals on-chain `getMerkleTreeRoot(712)`
- Temporary commitment `987654321098765432109876543210987654321` is no longer a member
- `AccessNFT.nextTokenId = 0`

## Publish Frontend

The Vercel frontend must be redeployed after `deployedContracts.ts` changes:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\packages\nextjs"
.\node_modules\.bin\vercel.cmd login
.\node_modules\.bin\vercel.cmd --prod
```

Vercel environment variables:

- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `YARN_ENABLE_IMMUTABLE_INSTALLS=false`
- `ENABLE_EXPERIMENTAL_COREPACK=1`

## Publish Mock API

The mock API is a separate Vercel project:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\mock-api"
.\node_modules\.bin\vercel.cmd login
.\node_modules\.bin\vercel.cmd link
.\node_modules\.bin\vercel.cmd --prod
```

Set `ADMIN_TOKEN` in that project and seed the smoke-test commitment:

```text
SEED_SANCTIONED=123456789012345678901234567890123456789
```

The Vercel serverless admin route is served at `/api/admin` (not
`/api/admin/sanction`). Verify it in the deployed environment:

```powershell
$headers = @{ 'x-admin-token' = '<ADMIN_TOKEN>' }
Invoke-RestMethod -Uri 'https://mock-api-topaz-zeta.vercel.app/api/admin' `
  -Method Post -Headers $headers -ContentType 'application/json' `
  -Body '{"action":"status"}'
```

Then update the CRE workflow:

```powershell
$env:SANCTIONS_API_URL = "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list"
$env:COMPLIANCE_GATE_ADDRESS = "0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70"
```

### CRE Workflow Compilation Evidence

The workflow TypeScript compiles under `tsc`, and the real CRE SDK compiler
has been executed with `npx bun` to produce `dist/compliance-lifecycle.wasm`:

```powershell
cd "F:\AI WORK\WEB 3.0 Decentralized\zk-cid\workflows\compliance-lifecycle"
npx -y bun@1.1.42 node_modules\@chainlink\cre-sdk\bin\cre-compile.ts main.ts dist\compliance-lifecycle.wasm --skip-type-checks
```

Or from the `zk-cid` workspace root:

```powershell
yarn workspace compliance-lifecycle compile:cre
```

The official CRE CLI (v1.36.0) now compiles this workflow successfully from a
copy of the workflow placed on a path without spaces (`cre workflow build
compliance-lifecycle -T staging-settings`; on Windows the CLI fails when the
path contains spaces). Binary hash with bun 1.2.21:
`482ea06d8a701e60b8149e1bea2f7ad7f53c14b85e8c2598575decafe0f9e31a`; the hash
changes with the bun version (bun 1.1.42 produced `5d914691…c67a`).
`cre workflow simulate` has also been executed successfully (2026-10-02) with
the official CLI v1.36.0; the raw log lives in
`workflows/compliance-lifecycle/evidence/cre-simulate-20261002-232950.log`.

## Known Production Gaps

- `demoMode` remains `true`; strict Semaphore validation should only be enabled after real proof generation is wired into the frontend.
- Broadcast is off by default in `cre workflow simulate`, so a local run produces no transaction (`txHashes: [""]`): the local simulation signer is not accepted by the production Keystone forwarder. A live broadcast needs CRE-network deployment access (`cre account access`).
- The contract side of that write path is done: `ComplianceGateReceiver` (`0xB5ad6413a16efd82b76212830f908B2D67C20425`, Blockscout + Sourcify verified) implements the official `ReceiverTemplate` pattern, only accepts reports from the Sepolia Keystone forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, and `ComplianceGate.creWorkflow` now points at the adapter instead of the deployer wallet.
- The live sanctions list must be seeded with the same commitment that is currently a member of the new `ComplianceGate` group; otherwise the CRE revocation demo has no intersection.
