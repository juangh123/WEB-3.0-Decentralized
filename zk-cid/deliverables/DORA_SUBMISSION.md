# ZK-CID — DoraHacks Submission Copy

Use this document as the final copy-paste source for the DoraHacks BUIDL
submission page.

Hackathon: https://dorahacks.io/hackathon/legal-hack-2026
Tracks: https://dorahacks.io/hackathon/legal-hack-2026/tracks
Bounties: https://dorahacks.io/hackathon/legal-hack-2026/bounties

Event facts (verified 2026-09-03, re-verified 2026-09-09):

- Organizer: Blockchain Legal Institute (BLI)
- Submission opens: 2026/05/15 12:01 | Deadline: 2026/11/01 01:01
- Prize pool: 20,000 USD total (still developing, per event page)
- Track chosen: LegalTech & RegTech / Law-Finance-Compliance
- Bounty target: Chainlink CRE "Best workflow with CRE" (2x $1,000, https://dorahacks.io/hackathon/bounty/1362)
- Second bounty available (optional): RYO-CHAN "Autonomous Agents" (6,000 USD, https://dorahacks.io/hackathon/bounty/1380)

## Submission Fields

**Project Name**

ZK-CID — Zero-Knowledge Compliance Identity & Decentralized Workflow Orchestration

**Tagline**

Prove you are compliant, protect who you are.

**Primary Track**

LegalTech & RegTech / Law, Finance & Compliance

**Relevant Bounty**

Chainlink CRE — Best Workflow / Decentralized Compliance Automation
(select this because the DoraHacks submission form lists the Chainlink CRE
bounty: https://dorahacks.io/hackathon/bounty/1362)

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
   `ComplianceGate.getMembers()`, and calls `revokeCredential` on matches.

## Architecture

- **ZKP**: Semaphore v4
- **Smart contracts**: Solidity 0.8.23, Hardhat, deployed on Sepolia
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

- `ComplianceGate`: `0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3`
- `AccessNFT`: `0xF0B9199CAeD03b5E0A5f9924f3B4171B56e70e64`
- Semaphore v4 dependency: `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`
- Deployer/issuer wallet: `0x951c41D827d0A6F5b9ef4C44943E3Feb25E51348`
- Current live commitment: `123456789012345678901234567890123456789`
- `groupId`: `625`
- `demoMode`: `true`
- `getMembers()`: `["123456789012345678901234567890123456789"]`

Key transactions:

- Issue credential: `0xf4e28de8931123e71e0e76fa8cff24f96a38ef3da8b691658c4461cd9f234682`
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
- End-to-end SDK simulation executed with the real CRE SDK TestRuntime
  (`yarn workspace compliance-lifecycle test:sim`): 3/3 tests pass. The
  workflow fetches the sanctions API, reads on-chain `getMembers()`,
  computes the intersection, generates a CRE report, and writes a revoke
  transaction — see `workflows/compliance-lifecycle/test/compliance-lifecycle.sim.test.ts`.
- Full `cre workflow simulate` (CRE CLI, DON network-level) has not been
  executed because the complete CRE CLI is not installed in this development
  environment; no CLI simulation output is fabricated. The honest boundary is
  documented in `workflows/compliance-lifecycle/evidence/README.md`.

## Known Limitations

- `demoMode = true` is kept for a repeatable hackathon demo; strict Semaphore
  validation is a production roadmap item.
- `revokeCredential` passes empty `merkleProofSiblings`; revocation is enforced
  by `hasBeenRevoked`, not by on-tree removal. A Merkle indexer is required for
  production on-tree removal.
- `creWorkflow` is currently set to the deployer wallet because the real CRE
  forwarder address has not been configured; issuer-manual/script revocation is
  used as the on-chain smoke-test evidence.

## Submission Materials (ready-to-upload files)

| Item | File | Notes |
|------|------|-------|
| Project logo (512x512) | `zk-cid/deliverables/media/zk-cid-logo-512.png` | App branding, black shield on white |
| Submission cover (1280x720) | `zk-cid/deliverables/media/submission-cover.png` | Use for OG / social preview |
| Pitch deck (8 slides, 16:9 PDF) | `zk-cid/deliverables/media/ZK-CID-Pitch-Deck.pdf` | English, matches PITCH_DECK.md |
| Architecture diagram | `zk-cid/deliverables/media/architecture-diagram.png` | Mermaid render, 880x821 |
| Video thumbnails | `zk-cid/deliverables/media/video-thumbnail-20s.png` / `video-thumbnail-60s.png` | Extracted from demo video |
| Screenshots | `zk-cid/docs/assets/demo-00-landing.png`, `demo-01-comparison.png`, `demo-02-identity.png`, `demo-03-issued-success.png`, `demo-03-issued.png` | For gallery upload |
| Demo video (file) | `zk-cid/packages/nextjs/public/demo/zk-cid-pitch-video-en.mp4` | 1920x1080, 3:30, 38 MB; also live-hosted |
| Submit copy | this file | Paste into the DoraHacks form |

## Final Checklist

See `zk-cid/deliverables/FINAL_SUBMISSION_CHECKLIST.md`.
