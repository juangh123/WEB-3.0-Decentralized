# ZK-CID: Zero-Knowledge Compliant Identity

## Slide 1: Title Slide
- **Project Name**: ZK-CID (Zero-Knowledge Compliant Identity)
- **Tagline**: Prove you're compliant, protect who you are.
- **Track**: Law / Finance / Compliance
- **Bounty**: Chainlink CRE (Compute-to-Rule Engine) Workflow
- **Visual**: A lock symbol morphing into a green checkmark.

## Slide 2: The Problem
- **The Paradox**: Web3 faces a critical contradiction.
- **Traditional KYC**: Forces users to expose full identity (name, ID, address) → High risk of data breaches & privacy loss.
- **Fully Anonymous DeFi**: Violates AML/KYC regulations → High legal risk & institutional barrier.
- **The Result**: You currently have to choose between privacy and compliance.

## Slide 3: The Solution
- **ZK-CID**: Decentralized Identity (DID) + Zero-Knowledge Proofs (ZKP).
- **How it works**:
  - Users are verified by a trusted Issuer off-chain.
  - They are added to an on-chain "Compliant Group" using anonymous commitments.
  - Users generate a ZK Proof to access services.
- **The Outcome**: You prove "I am compliant" without revealing "I am Alice".

## Slide 4: Architecture & Tech Stack
- **Track Focus**: Legal Tech for DeFi Compliance
- **Smart Contracts**: Solidity, deployed on Sepolia testnet; local Anvil/Hardhat used for reproducible tests.
- **ZKP Protocol**: Semaphore v4 (industry standard for anonymous signaling).
- **Automation**: Chainlink CRE Workflow for automated credential revocation.
- **Frontend**: Next.js, Scaffold-ETH 2, wagmi, viem.
- **Flow**: Local Identity -> Issuer Adds to Group -> Browser ZK Proof -> On-Chain Verification -> AccessNFT Minted.

## Slide 5: The Demo
- **Demo Video**: [Watch ZK & CRE Demo](https://web-3-0-decentralized.vercel.app/demo/zk-cid-pitch-video-en.mp4)
- **Screenshots**: See `docs/assets/`: `demo-00-landing.png` (privacy comparison), `demo-02-identity.png` (identity generation), `demo-03-issued-success.png` (credential issued).
- **Step 1**: User generates a local Semaphore identity.
- **Step 2**: Issuer adds the user's public commitment to the smart contract group.
- **Step 3**: User generates a ZK proof locally (no math leaves the device).
- **Step 4**: Smart contract verifies the proof, prevents replays, and grants DeFi access.

## Slide 6: Privacy Comparison
| Feature | Traditional KYC / Soulbound Tokens | ZK-CID |
| :--- | :--- | :--- |
| **Data Shared with Dapp** | Full Name, ID, Address | None (Only a cryptographic proof) |
| **On-chain Linkability** | High (Wallet is tied to identity) | Zero (Identity is decoupled from wallet) |
| **Regulatory Compliance** | Yes | Yes (Auditable but not identifiable) |
| **User Privacy** | Low | Absolute |

## Slide 7: Future Roadmap
- **Real-world Integration**: Partner with established KYC providers (e.g., Synaps, Fractal).
- **Cross-Chain Compliance**: Prove compliance on L2s using proofs generated on Ethereum L1.
- **Granular Tiers**: Support multiple compliance levels (e.g., Level 1: Basic, Level 2: Accredited Investor).
- **Revocation**: Implement advanced accumulator mechanisms to efficiently revoke bad actors.

## Slide 8: Thank You
- **Team**: Solo Developer
- **Github**: https://github.com/juangh123/WEB-3.0-Decentralized
- **Try it out**: https://web-3-0-decentralized.vercel.app
- **Q&A**



