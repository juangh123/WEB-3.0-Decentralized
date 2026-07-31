// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract MockSemaphoreVerifier {
    function verifyProof(
        uint256[2] memory pA,
        uint256[2][2] memory pB,
        uint256[2] memory pC,
        uint256[4] memory pubSignals
    ) public pure returns (bool) {
        return true;
    }
}
