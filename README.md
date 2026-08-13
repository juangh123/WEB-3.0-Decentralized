# ZK-CID 🛡️
**Zero-Knowledge Compliance Identity & Decentralized Workflow Orchestration**

> **一句话定位**: "ZK-CID 用 ZK 零知识证明保护 Web3 用户验证端隐私，用 Chainlink CRE 消除颁发端信任——合规数据由去中心化预言机网络自动编排，用户隐私由数学密码学守护。"

🏆 **Track**: Law / Finance / Compliance (Blockchain Legal Institute) & Best Workflow with CRE (Chainlink)

🌐 **Live Demo**: [https://web-3-0-decentralized.vercel.app](https://web-3-0-decentralized.vercel.app)

🎥 **Demo Video**: [Watch Demo on YouTube](https://youtu.be/dummy-link) *(Please imagine this as the uploaded video link since video files are excluded from Git)*

## Quick Overview

Current Web3 compliance is flawed: users leak privacy to centralized KYC gates, and manual revocation of sanctioned identities is slow. 

ZK-CID solves this with a **Dual-Trust Engine**:
- **Zero-Knowledge Privacy (Semaphore v4)**: Users generate local identities. Issuers only put anonymous commitments on-chain. Users generate ZK Proofs to access DeFi, keeping their real identity decoupled from their wallet.
- **Decentralized Automated Revocation (Chainlink CRE)**: Serverless workflows constantly watch external sanction APIs (like OFAC). If a compliant user is flagged, the decentralized oracle network automatically revokes their access on-chain.

## Architecture

`mermaid
graph TD
    A[User] -->|Real-world ID| B(Trusted KYC Issuer)
    B -->|Issues Commitment| C[ComplianceGate Smart Contract<br>Semaphore Group]
    A -->|Generates ZKP locally| D[DeFi ZK-Proof Submission]
    D --> E{ComplianceGate Verifies ZKP}
    E -->|Valid| F[Mint AccessNFT / Grant DeFi Access]
    E -->|Invalid/Revoked| G[Revert Transaction]
    H((Mock Sanction API)) -->|Chainlink CRE Workflow<br>Checks Sanctions| I(Oracle Node Consensus)
    I -.->|If Flagged: Auto-Revokes| C
`

## Repository Structure

The complete source code is located in the zk-cid subdirectory:

- zk-cid/packages/hardhat/ - Smart Contracts (Semaphore/Gate/AccessNFT)
- zk-cid/packages/nextjs/ - DApp Frontend (Identity/Proof)
- zk-cid/workflows/compliance-lifecycle/ - Chainlink CRE Orchestration
- zk-cid/mock-api/ - Mock Sanction API

Please navigate to [zk-cid/README.md](zk-cid/README.md) for detailed setup instructions and local end-to-end testing guides.
