# ZK-CID — DoraHacks Submission Copy

Use this document as the final copy-paste source for the DoraHacks BUIDL
submission page.

Hackathon: https://dorahacks.io/hackathon/legal-hack-2026
Tracks: https://dorahacks.io/hackathon/legal-hack-2026/tracks
Bounties: https://dorahacks.io/hackathon/legal-hack-2026/bounties

Event facts (verified 2026-09-03, re-verified 2026-09-09, API-checked 2026-10-02):

- Organizer: Blockchain Legal Institute (BLI)
- Submission opens: 2026/05/15 12:01 UTC | Deadline: 2026/11/01 01:01 UTC
  (= 2026-11-01 09:01 Beijing time; the event page displays the raw UTC value)
- Prize pool: 20,000 USD total (still developing, per event page)
- Track chosen: `All BUIDLs` (the only selectable track; the LegalTech & RegTech /
  Law-Finance-Compliance wording is a category inside that track's description,
  so keep it in the project description instead of the track field)
- Bounty target: Chainlink CRE "Best workflow with CRE" (2x $1,000, https://dorahacks.io/hackathon/bounty/1362)
- Second bounty (RYO-CHAN "Autonomous Agents", 6,000 USD,
  https://dorahacks.io/hackathon/bounty/1380) does **not** apply to ZK-CID —
  it targets autonomous trading/market-evidence agents; do not tick it.

## Submission Fields

**Project Name**

ZK-CID — Zero-Knowledge Compliance Identity & Decentralized Workflow Orchestration

**Tagline**

Prove you are compliant, protect who you are.

**Primary Track**

All BUIDLs

Category (for the description / vision text): LegalTech & RegTech — Law, Finance
& Compliance.

**Relevant Bounty**

Chainlink CRE — Best Workflow / Decentralized Compliance Automation
(select this because the DoraHacks submission form lists the Chainlink CRE
bounty: https://dorahacks.io/hackathon/bounty/1362)

Bounty evidence summary to paste alongside (hard requirement: a successful CRE
CLI simulation or a live CRE-network deployment):

- The official CRE CLI **v1.36.0** both builds and simulates this workflow. Raw
  output: `workflows/compliance-lifecycle/evidence/cre-simulate-20261002-232950.log`.
- `cre workflow simulate` ran the full orchestration for real: DON-consensus HTTP
  fetch of the sanctions list, `getMembers()` / `getLeaves()` reads against the
  Sepolia deployment, Semaphore-tree rebuild with real Merkle siblings, and the
  revoke branch — result `{"status":"revoked","revokedCount":1}`.
- Docker-free reproduction from a clean checkout: `cd zk-cid/workflows`,
  `cre login` (or `CRE_API_KEY`), `./run-cre-simulate.ps1`.

**Short Description**

ZK-CID lets a Web3 user prove they are compliance-approved without revealing
their identity. An issuer stores only an anonymous Semaphore commitment
on-chain; the user generates a zero-knowledge proof locally; a DeFi gate
verifies the proof and mints an AccessNFT. A Chainlink CRE serverless workflow
pulls an external sanctions list on a cron trigger, intersects it with on-chain
members, and revokes credentials automatically.

## Problem

Traditional KYC forces users to expose full identity documents, wallets, and
addresses, creating a honeypot of personal data. Fully anonymous DeFi creates
AML/KYC and legal risk for institutions. Current systems force a choice between
privacy and compliance.

## Solution

ZK-CID separates "prove compliance" from "reveal identity":

1. A licensed issuer verifies the user off-chain.
2. The issuer adds only the user's public commitment to a Semaphore group on-chain.
3. The user generates a ZK proof in the browser.
4. `ComplianceGate` verifies the proof, checks revocation status, and mints an
   AccessNFT through the whitelisted `AccessNFT` contract.
5. A Chainlink CRE workflow periodically pulls the sanctions API, reads
   `ComplianceGate.getMembers()` / `getLeaves()`, rebuilds the Semaphore tree,
   and calls `revokeCredentialWithMerkleProof` with real siblings on matches.

## Architecture

- **ZKP**: Semaphore v4
- **Smart contracts**: Solidity ^0.8.23 (compiled with 0.8.28), Hardhat, deployed on Sepolia
- **Frontend**: Next.js App Router, Scaffold-ETH 2, wagmi, viem
- **Automation**: Chainlink CRE SDK 1.16.0, TypeScript serverless workflow
- **Off-chain data**: Vercel mock sanctions API, unified JSON schema
- **Reproducible local environment**: Anvil/Hardhat

## Live URLs

- Demo: https://web-3-0-decentralized.vercel.app
- Main flow: https://web-3-0-decentralized.vercel.app/zk-cid
- Mock sanctions API: https://mock-api-topaz-zeta.vercel.app/api/sanctions-list
- Demo video: https://web-3-0-decentralized.vercel.app/demo/zk-cid-pitch-video-en.mp4
- GitHub: https://github.com/juangh123/WEB-3.0-Decentralized

## Sepolia Live Evidence

- `ComplianceGate`: `0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70`
- `AccessNFT`: `0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32`
- Source-verified on Blockscout and Sourcify (2026-10-02):
  - https://eth-sepolia.blockscout.com/address/0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70#code
  - https://eth-sepolia.blockscout.com/address/0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32#code
- Semaphore v4 dependency: `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`
- Deployer/issuer wallet: `0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348`
- Current live commitment: `123456789012345678901234567890123456789`
- `groupId`: `712`
- `demoMode`: `true`
- `getMembers()`: `["123456789012345678901234567890123456789"]`

Key transactions:

- Issue credential: `0x37e37f2a3cba81d6327bbfe0e7565649a51115771f0a1ad329ba788deef51dcf`
- Revoke temporary credential from tree: `0x8f0cb9341d4cf108101fb07a835c334c39f23ca9994bb26acc4497ee9e829ee0`
- Deployment details and reproduction steps: `zk-cid/SEPOLIA_DEPLOYMENT.md`

## Validation Commands

```powershell
yarn hardhat:test
yarn next:build
yarn next:lint --max-warnings=0
yarn hardhat:lint --max-warnings=0
yarn workspace compliance-lifecycle compile
yarn workspace compliance-lifecycle compile:cre
yarn workspace compliance-lifecycle test:sim
yarn workspace zk-cid-mock-sanctions-api test
node --check zk-cid/mock-api/server.js
```

Additional real-environment checks:

```powershell
# Sepolia status (public RPC)
cd zk-cid/packages/hardhat
.\node_modules\.bin\tsx.cmd scripts\sepoliaSmokeDemo.ts status

# Deployed API and admin route
Invoke-RestMethod -Uri 'https://mock-api-topaz-zeta.vercel.app/api/sanctions-list'
$headers = @{ 'x-admin-token' = '<ADMIN_TOKEN>' }
Invoke-RestMethod -Uri 'https://mock-api-topaz-zeta.vercel.app/api/admin' `
  -Method Post -Headers $headers -ContentType 'application/json' `
  -Body '{"action":"status"}'
```

## CRE Evidence

- `core.ts` / `main.ts` pass TypeScript compilation.
- Real `@chainlink/cre-sdk` compiler has been executed and produced
  `workflows/compliance-lifecycle/dist/compliance-lifecycle.wasm` (2.7 MB).
- Official CRE CLI v1.36.0 `cre workflow build compliance-lifecycle -T staging-settings`
  succeeds (verified 2026-10-02 on a copy of the workflow placed on a
  space-free path; the CLI fails on Windows paths containing spaces). Binary
  hash with bun 1.2.21: `d1246a6f879aa78eea039961a77f2fe201fde9b4cf6420a3ba346755e812626c`.
  The repo ships the official
  `workflows/project.yaml` + `workflow.yaml` schema the CLI requires.
- **Official `cre workflow simulate` executed end-to-end** (2026-10-02, CLI
  v1.36.0). Log: `workflows/compliance-lifecycle/evidence/cre-simulate-20261002-232950.log`.
  Verified chain: sanctions API fetch → `getMembers()` = 1 → `getLeaves()` = 2
  (1 active) → Merkle proof generated (`siblingCount=1`, siblings `["0"]`) →
  revoke branch → `{"status":"revoked","revokedCount":1}`. `txHashes` is empty
  because simulate does not broadcast, which is the documented boundary.
- **A real broadcast rehearsal produced an actual on-chain revocation**:
  [tx `0xb64c050e…`](https://eth-sepolia.blockscout.com/tx/0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9)
  (status success, 228k gas). After it, `getMembers()` was empty and
  `hasBeenRevoked(commitment)` was true. It was delivered through the Sepolia
  MockKeystoneForwarder (the adapter was pointed at it for the rehearsal and
  switched back to the production Keystone forwarder afterwards); full caveats
  in `workflows/compliance-lifecycle/evidence/cre-broadcast-evidence.md`.
- End-to-end SDK simulation executed with the real CRE SDK TestRuntime
  (`yarn workspace compliance-lifecycle test:sim`): 6/6 tests pass (3 flow +
  3 Poseidon compatibility vectors). The
  workflow fetches the sanctions API, reads on-chain `getMembers()` and
  `getLeaves()`, computes the intersection, rebuilds the Semaphore tree,
  generates a CRE report, and writes a tree-level revoke transaction — see
  `workflows/compliance-lifecycle/test/compliance-lifecycle.sim.test.ts`.
- Getting simulate to run exposed and fixed three real defects: `poseidon-lite`
  calls the browser global `atob()` (absent in the CRE WASM runtime) — replaced
  with a local LeanIMT + inlined Poseidon(2); the workflow read `process.env`
  which does not exist in that runtime; and a stale comment-only
  `project.yaml` shadowed the real project settings. Details in
  `workflows/compliance-lifecycle/evidence/README.md`.

## Known Limitations

- `demoMode = true` is kept for a repeatable hackathon demo; strict Semaphore
  validation is a production roadmap item.
- On-tree revocation is production-wired: the CRE workflow rebuilds the
  Semaphore tree from the contract's stable leaves and supplies real Merkle
  siblings to `revokeCredentialWithMerkleProof`.
- The CRE write path is wired for real broadcasts:
  `ComplianceGateReceiver` = `0xB5ad6413a16efd82b76212830f908B2D67C20425`
  (source-verified on Blockscout + Sourcify) implements the official
  `ReceiverTemplate` pattern, accepts reports only from the Sepolia Keystone
  forwarder `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, and
  `ComplianceGate.creWorkflow` now points at that adapter instead of the
  deployer wallet.
- `cre workflow simulate` runs with broadcast disabled, so local runs produce no
  transaction: signatures from a local simulation are not accepted by the
  production forwarder. A live broadcast therefore needs CRE-network deployment
  access (`cre account access`). The contract side is complete and covered by 7
  dedicated tests (forwarder-only access control + real revocation flow).

## Submission Materials (ready-to-upload files)

| Item | File | Notes |
|------|------|-------|
| Project logo (512x512) | `zk-cid/deliverables/media/zk-cid-logo-512.png` | App branding, black shield on white |
| Submission cover (1280x720) | `zk-cid/deliverables/media/submission-cover.png` | Use for OG / social preview |
| Pitch deck (8 slides, 16:9 PDF) | `zk-cid/deliverables/media/ZK-CID-Pitch-Deck.pdf` | English, matches PITCH_DECK.md |
| Architecture diagram | `zk-cid/deliverables/media/architecture-diagram.png` | Mermaid render, 880x821 |
| Video thumbnails | `zk-cid/deliverables/media/video-thumbnail-20s.png` / `video-thumbnail-60s.png` | Final-cut hook and live-demo frames |
| Screenshots | `zk-cid/docs/assets/demo-00-landing.png`, `demo-01-comparison.png`, `demo-02-identity.png`, `demo-03-issued-success.png`, `demo-03-issued.png` | For gallery upload |
| Demo video (file) | `zk-cid/packages/nextjs/public/demo/zk-cid-pitch-video-en.mp4` | 1920x1080, 2:48, 30 MB; English voiceover + captions, also live-hosted |
| Submit copy | this file | Paste into the DoraHacks form |

## Final Checklist

See `zk-cid/deliverables/FINAL_SUBMISSION_CHECKLIST.md`.
