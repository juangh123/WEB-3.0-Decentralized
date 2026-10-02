# ZK-CID Final Submission Checklist

Use this checklist immediately before submitting the DoraHacks BUIDL.

## Public Repository

- [x] Public repository: `https://github.com/juangh123/WEB-3.0-Decentralized`
- [x] Latest source and deployment artifacts are pushed to `origin/main`
- [x] `git status` is clean immediately before the final submit
- [x] No production/deployer private key, real `ADMIN_TOKEN`, or local `.env` file is committed (only public Anvil dev keys remain in local scripts)

## Live Demo

- [x] Frontend returns HTTP 200: `https://web-3-0-decentralized.vercel.app`
- [x] Main demo route loads: `/zk-cid`
- [x] Demo video is reachable: `/demo/zk-cid-pitch-video-en.mp4`
- [x] Mock API returns a real seeded commitment: `https://mock-api-topaz-zeta.vercel.app/api/sanctions-list`
- [x] Deployed admin route responds: `/api/admin` with `{"action":"status"}`

## Sepolia Consistency

- [x] `ComplianceGate` = `0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70`
- [x] `AccessNFT` = `0x5e7140b8c967440A5B7Db15a4B82F4e4428cCc32`
- [x] `deployedContracts.ts` includes both Sepolia addresses
- [x] Mock API seed commitment matches current `getMembers()`
- [x] Sepolia issue transaction recorded:
  `0x37e37f2a3cba81d6327bbfe0e7565649a51115771f0a1ad329ba788deef51dcf`
- [x] Sepolia on-tree removal verified:
  `0x8f0cb9341d4cf108101fb07a835c334c39f23ca9994bb26acc4497ee9e829ee0`
- [x] Both contracts source-verified on Blockscout + Sourcify (2026-10-02)
- [ ] Optional: verify on Etherscan Sepolia once `ETHERSCAN_API_KEY` is available

## CRE Workflow

- [x] `workflow.yaml`, `config.json`, and `.env.example` use the live
  Sepolia `ComplianceGate` address
- [x] `tsc` compilation passes
- [x] Real CRE SDK compilation produces `dist/compliance-lifecycle.wasm`
- [x] Official CRE CLI v1.36.0 `cre workflow build compliance-lifecycle -T staging-settings` succeeds
  (run from a space-free path copy; bun 1.2.21 → binary hash `482ea06d...`)
- [x] yarn workspace compliance-lifecycle test:sim (CRE SDK TestRuntime end-to-end simulation, 3/3 pass)
- [x] Official `cre workflow simulate` executed end-to-end with CLI v1.36.0 (log: `evidence/cre-simulate-20261002-232950.log`, receiver = `ComplianceGateReceiver`)
- [x] CRE write path wired: `ComplianceGateReceiver` deployed + source-verified, `ComplianceGate.creWorkflow` points at it, report payload is `abi.encode(uint256, uint256[])`, 7 adapter tests passing
- [x] Real broadcast rehearsal executed: tx `0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9` revoked the credential on Sepolia (via MockKeystoneForwarder; adapter switched back to the production forwarder afterwards)
- [ ] Blocked on Chainlink: a production DON broadcast needs CRE-network deployment access (`cre account access`); local simulation signatures are rejected by the production forwarder

## Regression Gates

- [x] `yarn hardhat:test`
- [x] `yarn next:build`
- [x] `yarn next:lint --max-warnings=0`
- [x] `yarn hardhat:lint --max-warnings=0`
- [x] `yarn workspace compliance-lifecycle compile`
- [x] `yarn workspace zk-cid-mock-sanctions-api test`
- [x] `node --check zk-cid/mock-api/server.js`

## Repository Hygiene

- [x] No tracked `*.log`, `*.pid`, or Vercel local state files
- [x] Large generated video production files are ignored
- [x] Only the intended frontend demo MP4 remains tracked under
  `zk-cid/packages/nextjs/public/demo/`

## DoraHacks Submission

- [x] Submission published to `legal-hack-2026` (2026-10-02, status `Under Review`)
- [x] Track confirmed: `All BUIDLs` (the only selectable track)
- [x] Bounty confirmed selected on the form: `Best workflow with CRE - 2x $1,000` (Chainlink CRE, bounty 1362)
- [x] Live URLs, repo URL, video URL and Sepolia tx links present on the BUIDL
- [x] Known Limitations section visible on the BUIDL, updated 2026-10-02 with the executed CRE CLI simulation and the remaining broadcast/forwarder boundary

## Submission Materials (prepared 2026-09-09)

- [x] Project logo: `zk-cid/deliverables/media/zk-cid-logo-512.png` (512x512)
- [x] Submission cover / OG image: `zk-cid/deliverables/media/submission-cover.png` (1280x720)
- [x] Pitch deck PDF: `zk-cid/deliverables/media/ZK-CID-Pitch-Deck.pdf` (8 slides, 16:9)
- [x] Architecture diagram: `zk-cid/deliverables/media/architecture-diagram.png`
- [x] Demo video thumbnails: `zk-cid/deliverables/media/video-thumbnail-20s.png`, `video-thumbnail-60s.png`
- [x] Screenshots gallery: `zk-cid/docs/assets/demo-00-landing.png`, `demo-01-comparison.png`, `demo-02-identity.png`, `demo-03-issued-success.png`, `demo-03-issued.png`
- [x] Demo video (30 MB, 1080p 2:48, English voiceover + captions) tracked and live-hosted
- [x] All live URLs re-verified 2026-09-15 (demo, /zk-cid, video, mock API, GitHub, Sepolia)
- [x] Submission copy, links, cover and video are attached to the BUIDL form
- [x] CRE evidence paragraph on the BUIDL updated twice: first to the executed CLI simulation (2026-10-02), then to the production-wired receiver adapter + the real broadcast revocation tx (2026-10-03, verified by reloading the live BUIDL page)
- [ ] Optional: upload the remaining pitch deck PDF / screenshot gallery files if the organizer asks for them explicitly
