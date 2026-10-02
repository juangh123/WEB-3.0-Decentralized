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

## CRE Workflow

- [x] `workflow.yaml`, `config.json`, and `.env.example` use the live
  Sepolia `ComplianceGate` address
- [x] `tsc` compilation passes
- [x] Real CRE SDK compilation produces `dist/compliance-lifecycle.wasm`
- [x] Official CRE CLI v1.36.0 `cre workflow build compliance-lifecycle -T staging-settings` succeeds
  (run from a space-free path copy; bun 1.2.21 → binary hash `482ea06d...`)
- [x] yarn workspace compliance-lifecycle test:sim (CRE SDK TestRuntime end-to-end simulation, 3/3 pass)
- [ ] Full `cre workflow simulate` (CRE CLI) not yet run: needs a Chainlink CRE account credential (`cre login` / `CRE_API_KEY`) — not claimed as passed, boundary documented

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

- [ ] Paste submission copy from `zk-cid/deliverables/DORA_SUBMISSION.md`
- [ ] Confirm primary track: LegalTech & RegTech / Law-Finance-Compliance
- [ ] Confirm bounty selection includes Chainlink CRE where available
- [ ] Confirm live URLs, repo URL, video URL, and Sepolia tx links
- [ ] Confirm Known Limitations section is visible to judges

## Submission Materials (prepared 2026-09-09)

- [x] Project logo: `zk-cid/deliverables/media/zk-cid-logo-512.png` (512x512)
- [x] Submission cover / OG image: `zk-cid/deliverables/media/submission-cover.png` (1280x720)
- [x] Pitch deck PDF: `zk-cid/deliverables/media/ZK-CID-Pitch-Deck.pdf` (8 slides, 16:9)
- [x] Architecture diagram: `zk-cid/deliverables/media/architecture-diagram.png`
- [x] Demo video thumbnails: `zk-cid/deliverables/media/video-thumbnail-20s.png`, `video-thumbnail-60s.png`
- [x] Screenshots gallery: `zk-cid/docs/assets/demo-00-landing.png`, `demo-01-comparison.png`, `demo-02-identity.png`, `demo-03-issued-success.png`, `demo-03-issued.png`
- [x] Demo video (30 MB, 1080p 2:48, English voiceover + captions) tracked and live-hosted
- [x] All live URLs re-verified 2026-09-15 (demo, /zk-cid, video, mock API, GitHub, Sepolia)
- [ ] Upload logo, cover, screenshots and pitch deck PDF on the DoraHacks BUIDL form
- [ ] Paste submission copy from `zk-cid/deliverables/DORA_SUBMISSION.md` (user action)
- [ ] Confirm primary track selection and Chainlink CRE bounty on the form (user action)
