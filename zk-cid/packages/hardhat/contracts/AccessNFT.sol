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

    /// @dev Accounts whose access pass has been revoked by the issuer (e.g. after a sanctions
    /// hit or a withdrawn KYC). Revocation is address-based because Semaphore proofs do not
    /// reveal which identity commitment minted the token; the issuer performs the match
    /// off-chain. `restoreAccess` re-enables the existing token without a re-mint.
    mapping(address => bool) public accessRevoked;

    event AccessRevoked(address indexed account);
    event AccessRestored(address indexed account);

    error NotIssuer();
    error TransferBlockedFromRevokedAccount(address account);

    constructor(address _complianceGate) ERC721("DeFi Access", "DFA") {
        complianceGate = ComplianceGate(_complianceGate);
    }

    modifier onlyIssuer() {
        if (msg.sender != complianceGate.issuer()) revert NotIssuer();
        _;
    }

    /// @notice Mint an access NFT against a Semaphore compliance proof.
    /// @dev Revocation is enforced inside `ComplianceGate.verifyCompliance` (which this call
    /// routes through), so no interface change is needed here: a proof whose credential was
    /// revoked reverts the whole mint. The gate only accepts verification calls from this
    /// contract, which keeps external EOAs from front-running proofs out of the mempool.
    function mint(ISemaphore.SemaphoreProof calldata proof) external {
        require(!hasMinted[msg.sender], "Already minted");
        require(!usedNullifiers[proof.nullifier], "Proof already used");
        require(proof.message == uint256(uint160(msg.sender)), "Message must bind sender");

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

    /// @notice Revoke an account's access pass after an off-chain compliance decision.
    function revokeAccess(address account) external onlyIssuer {
        require(account != address(0), "Zero address");
        accessRevoked[account] = true;
        emit AccessRevoked(account);
    }

    /// @notice Restore an account's access pass (re-issuance / successful appeal).
    function restoreAccess(address account) external onlyIssuer {
        accessRevoked[account] = false;
        emit AccessRestored(account);
    }

    /// @notice True only while the account holds a minted pass and its access is not revoked.
    /// @dev Consumers that gate resources on this NFT should check this view instead of
    /// `balanceOf`, because revocation intentionally does not burn the token.
    function isValid(address account) external view returns (bool) {
        return hasMinted[account] && !accessRevoked[account];
    }

    /// @dev A revoked account cannot move or burn its token, so the pass cannot be laundered
    /// to a clean address after a sanctions hit.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && accessRevoked[from]) {
            revert TransferBlockedFromRevokedAccount(from);
        }
        return super._update(to, tokenId, auth);
    }
}
