# ZK-CID — DoraHacks Submission Copy

Final copy-paste source for the DoraHacks BUIDL page
(<https://dorahacks.io/buidl/48603>). Refreshed on 2026-10-27 for the final update before the
deadline.

Hackathon: https://dorahacks.io/hackathon/legal-hack-2026 ·
Tracks: https://dorahacks.io/hackathon/legal-hack-2026/tracks ·
Bounty: https://dorahacks.io/hackathon/bounty/1362

Event facts (re-checked 2026-10-27 on the event pages):

- Organizer: Blockchain Legal Institute (BLI)
- Deadline: **2026-11-01 01:01 UTC** (= 2026-11-01 09:01 Beijing time; DoraHacks shows
  2026-10-31 19:01 in UTC-6). BUIDL edits are likely locked after the deadline.
- Track: `All BUIDLs` (the only selectable track). The track page lists LegalTech & RegTech
  as "Data privacy for minors, KYC/on-chain legal docs, and legal automation" and Web3 for
  Social Good as including "Decentralized identity"; ZK-CID covers both.
- Bounty: Chainlink "Best workflow with CRE" (2 × $1,000). Hard requirement: a CRE workflow
  that integrates a blockchain with an external API/system and a successful CLI simulation or
  a live deployment. ZK-CID meets it with the CLI simulation.
- The RYO-CHAN "Autonomous Agents" bounty (1380) does not apply; do not tick it.

## What to change on the BUIDL page in this update

1. **Logo**: upload `deliverables/media/zk-cid-logo-512.png`. The current logo is a white box
   with a tiny Scaffold-ETH icon.
2. **Cover image**: upload `deliverables/media/submission-cover.png` (the old cover has the
   same broken logo).
3. **Description**: replace the Details text with the sections below (Problem → Known
   limitations). The old copy still says "Final repository revision: 297cad3".
4. **Pitch deck**: attach `deliverables/media/ZK-CID-Pitch-Deck.pdf` (10 slides) if the form
   has a file or link field; otherwise link it from the repo.
5. Optional: add the CRE issuance-trigger simulation clip once it is recorded (see
   `CRE_RECORDING_GUIDE.md`).

## Submission fields

**Project name**: ZK-CID — Zero-Knowledge Compliance Identity & Decentralized Workflow Orchestration

**Tagline**: Prove you are compliant, protect who you are.

**One-line description** (short field):

> ZK-CID lets users prove compliance without revealing identity. Only an anonymous Semaphore
> commitment goes on-chain, proofs are generated locally, and a Chainlink CRE workflow screens
> every credential at issuance and on a schedule, revoking sanctioned members on-chain.

**Track**: All BUIDLs · **Bounty**: Chainlink CRE — Best workflow with CRE

---

## Details (paste from here)

### TRY IT IN 3 MINUTES (NO WALLET NEEDED)

1. Open https://web-3-0-decentralized.vercel.app/zk-cid and click "Generate random anonymous identity".
2. Tab 2: click "Demo issuer (testnet only)". A server-side issuer adds only your commitment to the on-chain Semaphore group on Sepolia.
3. Tab 1: click "Generate ZK proof". The Groth16 proof is computed in your browser.
4. Tab 3: click "Verify proof without gas". The page runs AccessNFT.mint as an eth_call against the live contracts, so the real Semaphore v4 verifier checks your proof in strict mode. Nothing is broadcast and no testnet ETH is needed.
5. Optional: connect a wallet with a little Sepolia ETH, regenerate the proof and mint the AccessNFT.

### PROBLEM

Traditional KYC forces users to hand identity documents, wallets and addresses to every service, building personal-data honeypots. Fully anonymous DeFi carries AML and sanctions risk institutions cannot accept. Screening usually happens once at onboarding, so designations made later slip through and revocation is manual. Age checks today mean collecting ID documents from children.

### SOLUTION

ZK-CID separates proving compliance from revealing identity, and automates the revocation side:

- A regulated issuer verifies the user off-chain, then adds only an anonymous Semaphore commitment to the on-chain compliance group.
- The user proves membership with a zero-knowledge proof generated locally and bound to their wallet (proof.message == msg.sender); every nullifier is single-use.
- ComplianceGate verifies the proof with the real Semaphore v4 verifier (strict mode) against the current Merkle root, and AccessNFT mints the access pass.
- A Chainlink CRE workflow screens credentials against an external sanctions feed at two moments: when a credential is issued (EVM log trigger on UserAdded) and every 5 minutes for all members (cron). Matches are removed from the on-chain Semaphore tree through a DON-signed report.

### CHAINLINK CRE WORKFLOW

- Handler 0, cron: re-screens every member. Handler 1, EVM log trigger on ComplianceGate.UserAdded (FINALIZED): screens each new credential at issuance.
- Pipeline: HTTP fetch of the sanctions feed with identical-result DON consensus → getMembers()/getLeaves() via EVMClient.callContract at the finalized block → Semaphore tree rebuilt in WASM (LeanIMT + Poseidon) with real Merkle siblings → runtime.report() → EVMClient.writeReport → ComplianceGateReceiver → revokeCredentialWithMerkleProof.
- Official CRE CLI v1.36.0: cre workflow build and cre workflow simulate run end to end against live Sepolia state, ending in {"status":"revoked","revokedCount":1}. Raw log: https://github.com/juangh123/WEB-3.0-Decentralized/blob/main/zk-cid/workflows/compliance-lifecycle/evidence/cre-simulate-20261002-232950.log
- A CRE report produced a real on-chain revocation: https://eth-sepolia.blockscout.com/tx/0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9 (broadcast rehearsal through the MockKeystoneForwarder; caveats documented).
- Production write path: ComplianceGateReceiver (official ReceiverTemplate pattern, Keystone forwarder only, source-verified): https://eth-sepolia.blockscout.com/address/0xB5ad6413a16efd82b76212830f908B2D67C20425#code
- 11 SDK TestRuntime workflow tests cover both handlers, batching, malformed feeds, failed writes and misrouted logs. Running simulate exposed three real runtime defects (a browser-only atob dependency, a process global, a shadowing project.yaml), all fixed.
- Evidence summary: https://github.com/juangh123/WEB-3.0-Decentralized/blob/main/zk-cid/workflows/compliance-lifecycle/evidence/README.md

### REGULATORY CONTEXT

- GDPR: data minimisation (Art. 5) and privacy by design (Art. 25); only a pseudonymous commitment and a nullifier go on-chain.
- OFAC / EU sanctions: screening at issuance and continuously, automated revocation, and a restoration path.
- Minors and age assurance (GDPR Art. 8, COPPA, UK Online Safety Act): the same primitive proves "over 18" membership without a birth date or ID reaching the service.
- FATF Travel Rule and MiCA: complementary to, not a replacement for, a VASP/CASP's own AML programme.
- Requirement-by-requirement mapping with open gaps: https://github.com/juangh123/WEB-3.0-Decentralized/blob/main/zk-cid/deliverables/LEGAL_MAPPING.md (technical mapping, not legal advice).

### ARCHITECTURE

- ZKP: Semaphore v4 (Groth16, LeanIMT)
- Smart contracts: Solidity 0.8.28 (pragma ^0.8.23), Hardhat 3, OpenZeppelin, Sepolia
- Frontend: Next.js App Router, Scaffold-ETH 2, wagmi, viem
- Orchestration: Chainlink CRE TypeScript SDK 1.16.0, CRE CLI 1.36.0
- Off-chain data: mock sanctions API on Vercel (issuer re-screening feed)

### LIVE EVIDENCE

- Demo: https://web-3-0-decentralized.vercel.app/zk-cid
- Pitch video (2:48): https://web-3-0-decentralized.vercel.app/demo/zk-cid-pitch-video-en.mp4
- Strict-mode acceptance clip (34 s): https://web-3-0-decentralized.vercel.app/demo/zk-cid-strict-mode-acceptance.mp4
- Mock sanctions API: https://mock-api-topaz-zeta.vercel.app/api/sanctions-list
- GitHub: https://github.com/juangh123/WEB-3.0-Decentralized

### SEPOLIA DEPLOYMENT

- ComplianceGate v2.2: 0x1b8ae78C37c3E29DFcB0236E1c562b3CCFA44F70
- AccessNFT v2: 0x7A52459d8eEF432fa3F044c152dd36ba1F3F931f
- ComplianceGateReceiver (CRE write path): 0xB5ad6413a16efd82b76212830f908B2D67C20425
- Semaphore v4: 0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D
- demoMode = false (strict Semaphore verification since 2026-10-10)
- All three contracts are source-verified on Blockscout and Sourcify.

Key transactions:

- Strict mode switch (2026-10-10): https://eth-sepolia.blockscout.com/tx/0xaab0962578786f644c6b1d39a5bb2a643c7ebdd2e20c1ea60647b447e57eca2f
- First strict-mode proof → AccessNFT mint (2026-10-17): https://eth-sepolia.blockscout.com/tx/0x03b17a4dbaa9bb3e8ad79de993bf99f50673874a4a874f7d4e986904372622b2
- Revocation with a real Merkle proof (2026-10-17): https://eth-sepolia.blockscout.com/tx/0x14469a82cf6bb4c7fc3a0cb716e329e6ed57bf558e61bad10a4eeddbf7035d78
- CRE broadcast revocation (2026-10-02): https://eth-sepolia.blockscout.com/tx/0xb64c050e37d7959951510eae66cc6994e11a7f640f8c4699f0d7e1050713e4d9

### VALIDATION (GITHUB ACTIONS ON EVERY PUSH)

- Contracts: 34 tests (including 7 CRE receiver tests)
- CRE workflow: 11 TestRuntime simulation tests + 3 Poseidon compatibility vectors; compiles to CRE WASM
- Frontend: 12 unit tests, 7 Playwright end-to-end tests, production build, lint, type checks
- Mock sanctions API: 13 tests
- Dependency audit gates: no high or critical advisories in direct dependencies and no critical ones transitively (Next.js upgraded to 16.4.2 for the October advisories)

### KNOWN LIMITATIONS

- No scheduled DON execution yet. The workflow is proven with the official CLI simulation and a broadcast rehearsal; running it on the Chainlink DON needs deploy access, which Chainlink grants after a commercial onboarding call and an MNDA (requested 2026-10-03). No contract or workflow change is needed.
- Revocation blocks future proofs, not passes minted earlier. AccessNFT.isValid means "minted and not manually revoked by the issuer"; a Semaphore proof does not reveal the commitment, so linking a token to a revoked credential would break privacy. Consumers should require a fresh proof for protected actions; pass expiry is on the roadmap.
- The sanctions feed is a mock (in-memory, single source). Production needs a licensed, versioned feed and human review of matches.
- The live receiver does not pin a workflow owner or ID yet; it only accepts the Keystone forwarder, and pinning follows once the deploying owner address exists.
- The demo group is small, so its anonymity set is small; privacy grows with the number of members.
- Contract unit tests use MockSemaphore for speed; the deployed path uses the real Semaphore v4 verifier, exercised by the strict-mode mint and the gas-free check.

---

## Submission materials

| Item | File |
| --- | --- |
| Logo (512×512) | `zk-cid/deliverables/media/zk-cid-logo-512.png` |
| Cover (1280×720) | `zk-cid/deliverables/media/submission-cover.png` |
| Pitch deck (10 slides, PDF) | `zk-cid/deliverables/media/ZK-CID-Pitch-Deck.pdf` |
| Architecture diagram | `zk-cid/deliverables/media/architecture-diagram.png` |
| Screenshots | `zk-cid/deliverables/screenshots/` |
| Pitch video | `zk-cid/packages/nextjs/public/demo/zk-cid-pitch-video-en.mp4` (also live) |
| Regulatory mapping | `zk-cid/deliverables/LEGAL_MAPPING.md` |

Final checklist: `zk-cid/deliverables/FINAL_SUBMISSION_CHECKLIST.md`.
