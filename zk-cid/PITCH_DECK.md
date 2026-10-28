# ZK-CID: Pitch Deck (text version)

The rendered deck is [`deliverables/media/ZK-CID-Pitch-Deck.pdf`](./deliverables/media/ZK-CID-Pitch-Deck.pdf)
(10 slides, 16:9). Its source is [`deliverables/media/source/deck.html`](./deliverables/media/source/deck.html);
open it in a browser and print to PDF (1280 × 720 px pages) to regenerate it.

## 1. Title
- **ZK-CID**: Zero-Knowledge Compliance Identity & Decentralized Workflow Orchestration
- **Tagline**: Prove you are compliant, protect who you are.
- BLI Legal Tech Hackathon 2 · LegalTech & RegTech · Chainlink CRE bounty · Live on Sepolia
- Demo: https://web-3-0-decentralized.vercel.app/zk-cid · Code: https://github.com/juangh123/WEB-3.0-Decentralized

## 2. Web3 is forced to choose: compliance or privacy
- Traditional KYC hands passports, faces and home addresses to every service. One breach leaks everything.
- Fully anonymous DeFi carries AML and sanctions risk that institutions cannot take on.
- Screening usually happens once, at onboarding. Later designations slip through; revocation is manual and slow.
- Age checks today mean collecting ID documents from children: the opposite of data minimisation.

## 3. Prove compliance without revealing identity
1. A regulated issuer verifies the user off-chain (documents, sanctions screening).
2. Only an anonymous Semaphore commitment is added to the on-chain compliance group.
3. The user proves membership with a zero-knowledge proof made in the browser and bound to their wallet.
4. ComplianceGate checks it with the real Semaphore v4 verifier, then AccessNFT mints the pass. Each proof works once.
5. A Chainlink CRE workflow screens at issuance and every 5 minutes, and revokes listed members on-chain.

## 4. Architecture
User browser → (commitment) → issuer → `ComplianceGate` (Semaphore group) ← `AccessNFT.mint(proof)`.
Sanctions feed → Chainlink CRE (cron + `UserAdded` log trigger) → DON-signed report →
`ComplianceGateReceiver` (Keystone forwarder only) → `revokeCredentialWithMerkleProof`.
Stack: Semaphore v4, Solidity 0.8.28 / Hardhat 3, Next.js + Scaffold-ETH 2, Chainlink CRE TS SDK 1.16 / CLI 1.36, Sepolia.

## 5. Chainlink CRE: the compliance lifecycle
- Handler 0, cron every 5 minutes: re-screen every member.
- Handler 1, EVM log trigger on `UserAdded` (finalized): screen each new credential at issuance.
- Pipeline: identical-result DON consensus on the feed → `getMembers()` / `getLeaves()` at the finalized
  block → Semaphore tree rebuild (LeanIMT + Poseidon in WASM) → DON-signed report → `writeReport` → receiver.
- Evidence: official CLI build + `simulate` against live Sepolia (`{"status":"revoked"}`); a CRE report
  produced a real on-chain revocation (tx `0xb64c050e…`); source-verified receiver; 11 TestRuntime workflow
  tests; 3 runtime defects found and fixed. Scheduled DON execution follows Chainlink's commercial onboarding.

## 6. Try it in 3 minutes, no wallet needed
Generate an identity → demo issuer adds the commitment on Sepolia → generate the proof locally → verify it
without gas (an `eth_call` runs the real strict-mode verifier on the live contracts). Strict mode since
10 Oct; first real-proof mint on 17 Oct (tx `0x03b17a4d…`); contracts verified on Blockscout + Sourcify.

## 7. How ZK-CID compares
| | Classic KYC gate | KYC token / soulbound badge | ZK-CID |
| --- | --- | --- | --- |
| What the dApp learns | Full identity | That this wallet passed KYC | Only that a valid proof was given |
| Wallet ↔ person link | Stored by every service | Public and permanent | None on-chain; unlinkable within the group |
| New sanctions | Manual review | Manual burn or revoke | Automated: CRE at issuance + every 5 min |
| Breach impact | Full PII | Identity graph of wallets | No PII at the dApp or on-chain |
| Replay / theft | Session-based | Transferable unless soulbound | Proof bound to wallet, single-use nullifier |

Privacy grows with group size; CRE automation is CLI-simulated today and runs on a schedule once deployed to the DON.

## 8. Regulatory fit (technical mapping, not legal advice)
- GDPR Art. 5 and 25: only a pseudonymous commitment and a nullifier go on-chain.
- Sanctions (OFAC, EU): screening at onboarding and continuously, automated revocation, restoration path.
- Minors and age assurance (GDPR Art. 8, COPPA, UK Online Safety Act): an "over 18" group gates by age without storing a birth date or ID.
- FATF Travel Rule and MiCA: complementary to a VASP/CASP's own AML programme.

## 9. Who pays, and why (proposed model)
- **Verifiers** (DeFi pools, RWA platforms): pay per verification or subscription; gate access without holding PII.
- **Issuers** (KYC providers): reusable ZK credentials, revenue per credential, no customer data shared.
- **Compliance teams**: continuous screening and revocation as a managed CRE workflow with replayable on-chain evidence.
- Go-to-market: permissioned DeFi and RWA venues that already KYC every investor; then attribute groups.
- Why now: MiCA fully applicable since 30 Dec 2024; UK Online Safety Act age checks enforced since 25 Jul 2025; designations keep changing after onboarding.

## 10. Status and roadmap
- Done: strict-mode verification live; CRE workflow with CLI-simulated cron handler, a real revocation tx and a new issuance trigger; gas-free on-chain verification; verified contracts and CI; regulatory mapping.
- Next: DON deployment after Chainlink onboarding; pass expiry so revocation reaches minted passes; licensed sanctions feed and review queue; attribute groups with per-app scopes; a KYC provider as the first production issuer.
- Thank you. Private by design, compliant by proof.
