// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";

/// @notice Minimal view of the revocation entry point used by the adapter.
interface IComplianceGateRevoker {
    function revokeCredentialWithMerkleProof(uint256 commitment, uint256[] calldata merkleProofSiblings) external;
}

/// @title ComplianceGateReceiver
/// @notice Production write path for the ZK-CID Chainlink CRE workflow.
///
/// @dev Why this contract exists: the deployed `ComplianceGate` predates CRE and
///      only authorises an EOA (`creWorkflow`) to revoke, so a DON-signed report
///      could never be accepted by it. Instead of redeploying the gate (which
///      would invalidate the verified deployment, its address and the whole
///      on-chain evidence chain), this adapter is deployed separately:
///
///        1. the CRE workflow calls `EVMClient.writeReport(receiver = adapter)`
///        2. the Chainlink KeystoneForwarder calls `onReport(metadata, report)`
///        3. this adapter decodes `(uint256 commitment, uint256[] siblings)`
///           and calls `ComplianceGate.revokeCredentialWithMerkleProof`
///        4. the issuer sets the gate's `creWorkflow` to this adapter address,
///           which makes the adapter an authorised caller
///
///      `ReceiverTemplate` enforces that only the configured forwarder can call
///      `onReport`, and optionally pins the workflow owner / name / id.
contract ComplianceGateReceiver is ReceiverTemplate {
    IComplianceGateRevoker public immutable complianceGate;

    event RevocationForwarded(uint256 indexed commitment, uint256 siblingCount);

    error InvalidComplianceGate();
    error EmptyReport();

    constructor(address forwarder, address gate) ReceiverTemplate(forwarder) {
        if (gate == address(0)) {
            revert InvalidComplianceGate();
        }
        complianceGate = IComplianceGateRevoker(gate);
    }

    /// @inheritdoc ReceiverTemplate
    /// @param report `abi.encode(uint256 commitment, uint256[] merkleProofSiblings)`
    function _processReport(bytes calldata report) internal override {
        if (report.length == 0) {
            revert EmptyReport();
        }

        (uint256 commitment, uint256[] memory merkleProofSiblings) = abi.decode(report, (uint256, uint256[]));

        complianceGate.revokeCredentialWithMerkleProof(commitment, merkleProofSiblings);

        emit RevocationForwarded(commitment, merkleProofSiblings.length);
    }
}
