// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IL2Registry} from "./interfaces/IL2Registry.sol";

/// @title HumanENSLinker
/// @notice Durin custom registrar for humanens.eth — verified subnames backed by World ID.
/// @dev World Chain. CCIP-Read (EIP-3668) for L1 ENS ownership checks.
contract HumanENSLinker {
    // ─── EIP-3668 ────────────────────────────────────────────────────────

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    // ─── State ───────────────────────────────────────────────────────────

    IL2Registry public immutable registry;
    address public owner;
    address public backendSigner;
    address public gatewaySigner;
    string[] public gatewayUrls;

    mapping(bytes32 => bytes32) public nullifierToSourceNode;
    mapping(bytes32 => address) public nullifierToRegistrant;
    mapping(bytes32 => bytes32) public sourceNodeToNullifier;
    mapping(bytes32 => bool) public subnameExists;
    mapping(bytes32 => bytes32) public agentToParentNullifier;
    mapping(bytes32 => bytes32) public labelHashToSourceNode;

    uint256 constant MAX_AGE = 10 minutes;

    // ─── Events ──────────────────────────────────────────────────────────

    event LinkRegistered(string label, bytes32 sourceNode, bytes32 nullifierHash, address registrant);
    event LinkRevoked(string label, bytes32 sourceNode);
    event LinkChallenged(string label, bytes32 sourceNode, address challenger);
    event AgentCreated(string parentLabel, string agentLabel, address agentAddress);
    event AgentRevoked(string parentLabel, string agentLabel);

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(
        address _registry,
        address _backendSigner,
        address _gatewaySigner,
        string[] memory _gatewayUrls
    ) {
        registry = IL2Registry(_registry);
        owner = msg.sender;
        backendSigner = _backendSigner;
        gatewaySigner = _gatewaySigner;
        gatewayUrls = _gatewayUrls;
    }

    // ─── Register Link (CCIP-Read) ──────────────────────────────────────

    /// @notice Reverts with OffchainLookup — gateway checks L1 ENS text record + owner.
    /// @param label The desired subname label (e.g., "alice")
    /// @param sourceName The full ENS name (e.g., "alice.eth") — needed by gateway to read L1
    /// @param sourceNode namehash of sourceName
    /// @param attestationData abi.encode(nullifierHash, timestamp, backendSig)
    function registerLink(
        string calldata label,
        string calldata sourceName,
        bytes32 sourceNode,
        bytes calldata attestationData
    ) external {
        revert OffchainLookup(
            address(this),
            gatewayUrls,
            abi.encode(sourceNode, "humanens", sourceName),
            this.registerLinkCallback.selector,
            abi.encode(msg.sender, label, sourceNode, sourceName, attestationData)
        );
    }

    /// @notice Callback — verifies signatures, mints subname.
    function registerLinkCallback(
        bytes calldata response,
        bytes calldata extraData
    ) external {
        (address registrant, string memory label, bytes32 sourceNode, string memory sourceName, bytes memory attestationData) =
            abi.decode(extraData, (address, string, bytes32, string, bytes));

        // Verify backend attestation (World ID)
        (bytes32 nullifierHash, uint256 attTimestamp, bytes memory attSig) =
            abi.decode(attestationData, (bytes32, uint256, bytes));
        require(block.timestamp <= attTimestamp + MAX_AGE, "Attestation expired");
        bytes32 attHash = keccak256(abi.encodePacked(registrant, nullifierHash, sourceNode, label, attTimestamp));
        require(_recover(attHash, attSig) == backendSigner, "Bad backend sig");

        // Verify gateway response (L1 ownership)
        (bytes32 proofSourceNode, string memory value, address ensOwner, uint256 proofTimestamp, bytes memory gatewaySig) =
            abi.decode(response, (bytes32, string, address, uint256, bytes));
        require(block.timestamp <= proofTimestamp + MAX_AGE, "Proof expired");
        require(proofSourceNode == sourceNode, "SourceNode mismatch");
        string memory expected = string(abi.encodePacked(label, ".humanens.eth"));
        require(keccak256(bytes(value)) == keccak256(bytes(expected)), "Text record mismatch");
        require(ensOwner == registrant, "Not ENS owner");
        bytes32 proofHash = keccak256(abi.encodePacked(proofSourceNode, value, ensOwner, proofTimestamp));
        require(_recover(proofHash, gatewaySig) == gatewaySigner, "Bad gateway sig");

        // Uniqueness checks
        require(sourceNodeToNullifier[sourceNode] == bytes32(0), "Link exists");
        require(nullifierToSourceNode[nullifierHash] == bytes32(0), "Nullifier used");

        // Store
        nullifierToSourceNode[nullifierHash] = sourceNode;
        nullifierToRegistrant[nullifierHash] = registrant;
        sourceNodeToNullifier[sourceNode] = nullifierHash;
        labelHashToSourceNode[keccak256(bytes(label))] = sourceNode;

        // Mint subname
        bytes32 baseNode = registry.baseNode();
        bytes32 node = registry.makeNode(baseNode, label);
        subnameExists[node] = true;
        registry.createSubnode(baseNode, label, address(this), new bytes[](0));
        registry.setAddr(node, registrant);
        registry.setText(node, "world-id-verified", "true");
        registry.setText(node, "world-id-level", "orb");
        registry.setText(node, "source-name", sourceName);

        emit LinkRegistered(label, sourceNode, nullifierHash, registrant);
    }

    // ─── Revoke Link ─────────────────────────────────────────────────────

    function revokeLink(
        string calldata label,
        bytes32 nullifierHash,
        uint256 timestamp,
        bytes calldata sig
    ) external {
        bytes32 sourceNode = nullifierToSourceNode[nullifierHash];
        require(sourceNode != bytes32(0), "No link");

        require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
        bytes32 h = keccak256(abi.encodePacked(msg.sender, nullifierHash, sourceNode, label, timestamp));
        require(_recover(h, sig) == backendSigner, "Bad backend sig");

        bytes32 baseNode = registry.baseNode();
        bytes32 node = registry.makeNode(baseNode, label);
        registry.burn(uint256(node));
        _clearLink(nullifierHash, sourceNode, node, label);

        emit LinkRevoked(label, sourceNode);
    }

    // ─── Challenge Stale Link (CCIP-Read) ────────────────────────────────

    /// @notice Anyone can challenge a link. Gateway re-checks L1 text record + owner.
    function challengeLink(string calldata label, string calldata sourceName) external {
        bytes32 baseNode = registry.baseNode();
        bytes32 node = registry.makeNode(baseNode, label);
        require(subnameExists[node], "No link");

        bytes32 sourceNode = labelHashToSourceNode[keccak256(bytes(label))];
        require(sourceNode != bytes32(0), "No source");

        revert OffchainLookup(
            address(this),
            gatewayUrls,
            abi.encode(sourceNode, "humanens", sourceName),
            this.challengeLinkCallback.selector,
            abi.encode(msg.sender, label, node, sourceNode)
        );
    }

    /// @notice Callback — burns subname if L1 link is broken.
    function challengeLinkCallback(
        bytes calldata response,
        bytes calldata extraData
    ) external {
        (address challenger, string memory label, bytes32 node, bytes32 sourceNode) =
            abi.decode(extraData, (address, string, bytes32, bytes32));

        // Verify gateway response
        (bytes32 proofSourceNode, string memory value, address ensOwner, uint256 proofTimestamp, bytes memory gatewaySig) =
            abi.decode(response, (bytes32, string, address, uint256, bytes));
        require(block.timestamp <= proofTimestamp + MAX_AGE, "Proof expired");
        require(proofSourceNode == sourceNode, "SourceNode mismatch");
        bytes32 proofHash = keccak256(abi.encodePacked(proofSourceNode, value, ensOwner, proofTimestamp));
        require(_recover(proofHash, gatewaySig) == gatewaySigner, "Bad gateway sig");

        // Check if link is still valid
        string memory expected = string(abi.encodePacked(label, ".humanens.eth"));
        bool textValid = keccak256(bytes(value)) == keccak256(bytes(expected));
        bool ownerValid = ensOwner == nullifierToRegistrant[sourceNodeToNullifier[sourceNode]];
        require(!textValid || !ownerValid, "Link still valid");

        // Stale — burn and clear
        bytes32 nullifier = sourceNodeToNullifier[sourceNode];
        registry.burn(uint256(node));
        _clearLink(nullifier, sourceNode, node, label);

        emit LinkChallenged(label, sourceNode, challenger);
    }

    // ─── Agent Subnames ──────────────────────────────────────────────────

    function createAgentSubname(
        string calldata parentLabel,
        string calldata agentLabel,
        address agentAddress,
        bytes32 nullifierHash,
        uint256 timestamp,
        bytes calldata sig
    ) external {
        require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
        bytes32 h = keccak256(abi.encodePacked(msg.sender, nullifierHash, parentLabel, agentLabel, agentAddress, timestamp));
        require(_recover(h, sig) == backendSigner, "Bad backend sig");
        require(nullifierToSourceNode[nullifierHash] != bytes32(0), "No parent link");

        bytes32 baseNode = registry.baseNode();
        bytes32 parentNode = registry.makeNode(baseNode, parentLabel);
        require(subnameExists[parentNode], "Parent not found");

        bytes32 agentNode = registry.makeNode(parentNode, agentLabel);
        require(!subnameExists[agentNode], "Agent exists");

        subnameExists[agentNode] = true;
        agentToParentNullifier[agentNode] = nullifierHash;

        registry.createSubnode(parentNode, agentLabel, address(this), new bytes[](0));
        registry.setAddr(agentNode, agentAddress);
        registry.setText(agentNode, "agent", "true");
        registry.setText(agentNode, "operator", parentLabel);

        emit AgentCreated(parentLabel, agentLabel, agentAddress);
    }

    function revokeAgentSubname(
        string calldata parentLabel,
        string calldata agentLabel,
        bytes32 nullifierHash,
        uint256 timestamp,
        bytes calldata sig
    ) external {
        require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
        bytes32 h = keccak256(abi.encodePacked(msg.sender, nullifierHash, parentLabel, agentLabel, timestamp));
        require(_recover(h, sig) == backendSigner, "Bad backend sig");

        bytes32 baseNode = registry.baseNode();
        bytes32 parentNode = registry.makeNode(baseNode, parentLabel);
        bytes32 agentNode = registry.makeNode(parentNode, agentLabel);
        require(agentToParentNullifier[agentNode] == nullifierHash, "Not owner");

        registry.burn(uint256(agentNode));
        subnameExists[agentNode] = false;
        delete agentToParentNullifier[agentNode];

        emit AgentRevoked(parentLabel, agentLabel);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    function setBackendSigner(address _s) external { require(msg.sender == owner); backendSigner = _s; }
    function setGatewaySigner(address _s) external { require(msg.sender == owner); gatewaySigner = _s; }
    function setGatewayUrls(string[] calldata _urls) external { require(msg.sender == owner); gatewayUrls = _urls; }
    function transferOwnership(address _o) external { require(msg.sender == owner); owner = _o; }

    // ─── Internal ────────────────────────────────────────────────────────

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (bytes32 r, bytes32 s, uint8 v) = _splitSig(sig);
        return ecrecover(ethHash, v, r, s);
    }

    function _splitSig(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Bad sig len");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
    }

    function _clearLink(bytes32 nullifier, bytes32 sourceNode, bytes32 node, string memory label) internal {
        delete nullifierToSourceNode[nullifier];
        delete nullifierToRegistrant[nullifier];
        delete sourceNodeToNullifier[sourceNode];
        delete labelHashToSourceNode[keccak256(bytes(label))];
        subnameExists[node] = false;
    }
}
