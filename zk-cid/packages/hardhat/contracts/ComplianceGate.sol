// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title ComplianceGate v2.1
/// @notice Issues, verifies and revokes ZK compliance credentials on top of a Semaphore group.
/// @dev Lifecycle: the Issuer (or the CRE workflow) issues credentials as members of a dedicated
/// Semaphore group -> AccessNFT verifies a Semaphore proof through this gate -> the credential
/// can later be revoked on-chain by the Issuer / CRE workflow.
///
/// Known Limitations / Demo Mode:
/// - `demoMode` (default: true) skips the on-chain Semaphore ZK validation so mocked proofs can
///   drive local demos end to end. The issuer can switch it off with `setDemoMode(false)`; in
///   strict mode any invalid proof reverts inside `semaphore.validateProof` and is never swallowed.
/// - A Semaphore proof does not reveal the identity commitment, so an on-chain revocation cannot
///   be matched to a proof 1:1. As a demo-grade substitute, revocation is enforced against
///   `proof.merkleTreeRoot`: in the demo the group is operated as a single-member tree whose root
///   equals the member commitment. In production, revocation must instead remove the member from
///   the Semaphore group (see `revokeCredential`) so stale proofs fail the Merkle root check
///   performed by `validateProof`.
contract ComplianceGate {
    ISemaphore public semaphore;
    uint256 public groupId;
    address public issuer;
    address public creWorkflow;
    address public accessNFT;
    bool public demoMode;

    mapping(uint256 => bool) public verifiedNullifiers;
    mapping(uint256 => bool) public hasBeenRevoked;
    mapping(uint256 => bool) public isMember;
    uint256[] public members;
    /// @dev Index of each commitment in the `members` array, enabling O(1) removal.
    mapping(uint256 => uint256) public memberIndices;
    /// @dev Addresses authorized to call `verifyCompliance` (decouples AccessNFT hard-wiring).
    mapping(address => bool) public verifiers;

    event UserAdded(uint256 indexed commitment);
    event CredentialRevoked(uint256 indexed commitment);
    event ComplianceVerified(uint256 indexed nullifier);
    event WorkflowUpdated(address indexed workflow);
    event AccessNFTUpdated(address indexed accessNFT);
    event DemoModeUpdated(bool demoMode);
    event DemoProofAccepted(uint256 indexed nullifier);

    modifier onlyAuthorized() {
        require(msg.sender == issuer || msg.sender == creWorkflow, "Not authorized");
        _;
    }

    modifier onlyIssuer() {
        require(msg.sender == issuer, "Not issuer");
        _;
    }

    /// @dev Only registered verifier contracts may trigger proof verification.
    /// This blocks mempool front-running griefing: an external EOA can no longer copy a
    /// proof and call this function directly to burn the victim's nullifier.
    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Not a verifier");
        _;
    }

    constructor(address _semaphore) {
        require(_semaphore != address(0), "Semaphore address required");
        semaphore = ISemaphore(_semaphore);
        issuer = msg.sender;
        demoMode = true;

        // Create a dedicated Semaphore group administrated by this contract at deploy time
        // instead of relying on a hard-coded group id.
        groupId = semaphore.createGroup(address(this));
    }

    function setWorkflow(address _workflow) external onlyIssuer {
        creWorkflow = _workflow;
        emit WorkflowUpdated(_workflow);
    }

    function setAccessNFT(address _accessNFT) external onlyIssuer {
        accessNFT = _accessNFT;
        emit AccessNFTUpdated(_accessNFT);
    }

    /// @notice Register or remove a verifier contract (e.g. AccessNFT) that may call `verifyCompliance`.
    function setVerifier(address _verifier, bool _status) external onlyIssuer {
        verifiers[_verifier] = _status;
    }

    function setDemoMode(bool _demoMode) external onlyIssuer {
        demoMode = _demoMode;
        emit DemoModeUpdated(_demoMode);
    }

    function issueCredential(uint256 commitment) external onlyAuthorized {
        require(!isMember[commitment], "Already issued");
        isMember[commitment] = true;
        // A fresh issuance clears any previous revocation marker for this commitment.
        hasBeenRevoked[commitment] = false;

        semaphore.addMember(groupId, commitment);
        memberIndices[commitment] = members.length;
        members.push(commitment);
        emit UserAdded(commitment);
    }

    /// @notice Revoke credential (called automatically by the CRE Workflow on sanctions hits).
    function revokeCredential(uint256 commitment, uint256[] calldata merkleProofSiblings) external onlyAuthorized {
        require(!hasBeenRevoked[commitment], "Already revoked");
        require(isMember[commitment], "Unknown credential");
        hasBeenRevoked[commitment] = true;
        isMember[commitment] = false;

        // Remove the member from the on-chain Semaphore group when the off-chain Merkle proof
        // siblings are available. Known Limitation: the CRE demo does not run a Merkle indexer,
        // so it calls this function with an empty siblings array and the on-tree removal is
        // skipped; the `hasBeenRevoked` marker above stays the enforcement source and is checked
        // again in `verifyCompliance`.
        if (merkleProofSiblings.length > 0) {
            semaphore.removeMember(groupId, commitment, merkleProofSiblings);
        }

        // O(1) swap-delete from the members array using the pre-computed index.
        uint256 idx = memberIndices[commitment];
        uint256 lastIdx = members.length - 1;
        if (idx != lastIdx) {
            uint256 lastCommitment = members[lastIdx];
            members[idx] = lastCommitment;
            memberIndices[lastCommitment] = idx;
        }
        members.pop();
        delete memberIndices[commitment];

        emit CredentialRevoked(commitment);
    }

    /// @notice Verify a Semaphore proof. Callable only by registered verifier contracts.
    function verifyCompliance(ISemaphore.SemaphoreProof calldata proof) external onlyVerifier {
        require(!verifiedNullifiers[proof.nullifier], "Replay detected");
        // Revocation enforcement. Known Limitation: the proof does not carry the commitment,
        // so the check runs against proof.merkleTreeRoot (see contract-level docs). In the demo
        // flow (single-member group) the root equals the revoked commitment and this closes the
        // loop; the production path is the on-tree removal in `revokeCredential`.
        require(!hasBeenRevoked[proof.merkleTreeRoot], "Credential revoked");

        if (demoMode) {
            // Demo Mode: accept the proof without on-chain ZK validation so mock proofs can
            // drive the demo. The acceptance is explicit and observable via DemoProofAccepted.
            emit DemoProofAccepted(proof.nullifier);
        } else {
            // Strict Mode: a failing Semaphore validation MUST revert. No try/catch swallowing.
            semaphore.validateProof(groupId, proof);
        }

        verifiedNullifiers[proof.nullifier] = true;
        emit ComplianceVerified(proof.nullifier);
    }

    function getMembers() external view returns (uint256[] memory) {
        return members;
    }
}
