// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title MockSemaphore
/// @notice Local/testing stand-in for the Semaphore v4 contract.
/// @dev Tracks group ids, admins and members so ComplianceGate can run its full lifecycle
/// against the local EDR/Anvil network. ZK validation itself is a configurable no-op:
/// `validationShouldPass` lets tests and demos simulate an invalid proof.
/// Note: group ids start at 1 here (pre-increment) for continuity with earlier local
/// deployments that used the hard-coded groupId = 1; the production Semaphore contract
/// starts its group counter at 0.
contract MockSemaphore is ISemaphore {
    uint256 public nextGroupId;
    mapping(uint256 => uint256[]) public groups;
    mapping(uint256 => address) public groupAdmins;
    /// @dev groupId -> identityCommitment -> index, enabling O(1) removal per group.
    mapping(uint256 => mapping(uint256 => uint256)) public memberIndices;

    /// @dev Testing hook: when false, `validateProof` reverts and `verifyProof` returns false,
    /// simulating an invalid ZK proof. Defaults to true (every proof passes).
    bool public validationShouldPass = true;

    function groupCounter() external view returns (uint256) {
        return nextGroupId;
    }

    function setValidationResult(bool _shouldPass) external {
        validationShouldPass = _shouldPass;
    }

    function createGroup() external returns (uint256) {
        return _createGroup(msg.sender);
    }

    function createGroup(address admin) external returns (uint256) {
        return _createGroup(admin);
    }

    function createGroup(address admin, uint256 merkleTreeDuration) external returns (uint256) {
        return _createGroup(admin);
    }

    function _createGroup(address admin) internal returns (uint256 groupId) {
        groupId = ++nextGroupId;
        groupAdmins[groupId] = admin;
    }

    function updateGroupAdmin(uint256 groupId, address newAdmin) external {
        groupAdmins[groupId] = newAdmin;
    }

    function acceptGroupAdmin(uint256 groupId) external {}

    function updateGroupMerkleTreeDuration(uint256 groupId, uint256 newMerkleTreeDuration) external {}

    function addMember(uint256 groupId, uint256 identityCommitment) external {
        memberIndices[groupId][identityCommitment] = groups[groupId].length;
        groups[groupId].push(identityCommitment);
    }

    function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external {
        uint256 startIdx = groups[groupId].length;
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            memberIndices[groupId][identityCommitments[i]] = startIdx + i;
            groups[groupId].push(identityCommitments[i]);
        }
    }

    function updateMember(
        uint256 groupId,
        uint256 identityCommitment,
        uint256 newIdentityCommitment,
        uint256[] calldata merkleProofSiblings
    ) external {
        uint256 idx = memberIndices[groupId][identityCommitment];
        groups[groupId][idx] = newIdentityCommitment;
        memberIndices[groupId][newIdentityCommitment] = idx;
        delete memberIndices[groupId][identityCommitment];
    }

    function removeMember(
        uint256 groupId,
        uint256 identityCommitment,
        uint256[] calldata merkleProofSiblings
    ) external {
        uint256 idx = memberIndices[groupId][identityCommitment];
        uint256[] storage membersArr = groups[groupId];
        uint256 lastIdx = membersArr.length - 1;
        if (idx != lastIdx) {
            uint256 lastCommitment = membersArr[lastIdx];
            membersArr[idx] = lastCommitment;
            memberIndices[groupId][lastCommitment] = idx;
        }
        membersArr.pop();
        delete memberIndices[groupId][identityCommitment];
    }

    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external view {
        if (!validationShouldPass) revert Semaphore__InvalidProof();
    }

    function verifyProof(uint256 groupId, SemaphoreProof calldata proof) external view returns (bool) {
        return validationShouldPass;
    }
}
