// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title IERC165
/// @dev Vendored from smartcontractkit/cre-templates (Apache-2.0/MIT example code)
///      so this repository does not need an extra package dependency.
interface IERC165 {
    /// @notice Returns true if this contract implements the interface defined by `interfaceId`.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
