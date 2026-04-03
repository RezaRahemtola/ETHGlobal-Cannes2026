// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @notice Minimal interface for Durin L2 Registry (deployed via L2RegistryFactory on World Chain)
/// @dev Full source: https://github.com/resolverworks/durin
interface IL2Registry {
    /// @notice The base node (namehash) for this registry (e.g., namehash("humanens.eth"))
    function baseNode() external view returns (bytes32);

    /// @notice Create a subname under the base node
    /// @param node The parent node (use baseNode())
    /// @param label The subname label (e.g., "alice")
    /// @param owner The owner of the newly minted ERC-721 subname
    /// @param data Multicall data for setting records atomically (can be empty)
    /// @return The namehash of the created subname
    function createSubnode(
        bytes32 node,
        string calldata label,
        address owner,
        bytes[] calldata data
    ) external returns (bytes32);

    /// @notice Compute the namehash of a label under a parent node
    function makeNode(
        bytes32 parentNode,
        string calldata label
    ) external pure returns (bytes32);

    /// @notice Get the owner of a node (ERC-721 ownerOf by namehash)
    function owner(bytes32 node) external view returns (address);

    /// @notice ERC-721 ownerOf by tokenId (tokenId = uint256(node))
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Set the ETH address for a node
    function setAddr(bytes32 node, address addr) external;

    /// @notice Set an address for a specific coin type (ENSIP-9)
    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external;

    /// @notice Set a text record
    function setText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external;

    /// @notice Set the contenthash
    function setContenthash(bytes32 node, bytes calldata hash) external;

    /// @notice Add a registrar that can mint subnames
    function addRegistrar(address registrar) external;

    /// @notice Remove a registrar
    function removeRegistrar(address registrar) external;

    /// @notice Check if an address is an authorized registrar
    function registrars(address registrar) external view returns (bool);

    /// @notice Burn a token (delete a subname)
    function burn(uint256 tokenId) external;
}
