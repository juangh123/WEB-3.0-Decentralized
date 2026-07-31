// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./ComplianceGate.sol";

contract AccessNFT is ERC721 {
    ComplianceGate public complianceGate;
    uint256 public nextTokenId;
    mapping(address => bool) public hasMinted;

    // Using nullifier to prevent minting multiple times with the same proof
    mapping(uint256 => bool) public usedNullifiers;

    constructor(address _complianceGate) ERC721("DeFi Access", "DFA") {
        complianceGate = ComplianceGate(_complianceGate);
    }

    /// @notice Mint an access NFT against a Semaphore compliance proof.
    /// @dev Revocation is enforced inside `ComplianceGate.verifyCompliance` (which this call
    /// routes through), so no interface change is needed here: a proof whose credential was
    /// revoked reverts the whole mint. The gate only accepts verification calls from this
    /// contract, which keeps external EOAs from front-running proofs out of the mempool.
    function mint(ISemaphore.SemaphoreProof calldata proof) external {
        require(!hasMinted[msg.sender], "Already minted");
        require(!usedNullifiers[proof.nullifier], "Proof already used");

        // Effects first (checks-effects-interactions): mark before calling out to the gate.
        usedNullifiers[proof.nullifier] = true;
        hasMinted[msg.sender] = true;

        // Verify the proof through the ComplianceGate (reverts on replay, revocation,
        // or — outside demo mode — an invalid ZK proof).
        complianceGate.verifyCompliance(proof);

        // Mint NFT
        _safeMint(msg.sender, nextTokenId);
        nextTokenId++;
    }
}
