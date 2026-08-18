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

- [x] `ComplianceGate` = `0xB393C4Aace43162b170d4f6A84a60fA1AF9D1Ef3`
- [x] `AccessNFT` = `0xF0B9199CAeD03b5E0A5f9924f3B4171B56e70e64`
- [x] `deployedContracts.ts` includes both Sepolia addresses
- [x] Mock API seed commitment matches current `getMembers()`
- [x] Sepolia issue transaction recorded:
  `0xf4e28de8931123e71e0e76fa8cff24f96a38ef3da8b691658c4461cd9f234682`

## CRE Workflow

- [x] `workflow.yaml`, `config.json`, and `.env.example` use the live
  Sepolia `ComplianceGate` address
- [x] `tsc` compilation passes
- [x] Real CRE SDK compilation produces `dist/compliance-lifecycle.wasm`
- [x] Full `cre workflow simulate` is not claimed as passed

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
