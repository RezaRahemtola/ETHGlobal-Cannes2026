// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IL2Registry} from "./interfaces/IL2Registry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @title HumanENSLinker
/// @notice Custom registrar for humanens.eth — verified subnames backed by World ID.
/// @dev Deployed on World Chain. Uses CCIP-Read (EIP-3668) to verify L1 ENS ownership off-chain
///      via a gateway, then validates gateway + backend signatures on-chain before minting subnames.
///
///      Flow: registerLink() reverts with OffchainLookup → client calls gateway → client calls
///      registerLinkCallback() with signed response → contract verifies sigs & mints subname.
contract HumanENSLinker is Ownable, IERC721Receiver {
  // ─── EIP-3668 ────────────────────────────────────────────────────────

  error OffchainLookup(
    address sender,
    string[] urls,
    bytes callData,
    bytes4 callbackFunction,
    bytes extraData
  );

  // ─── State ───────────────────────────────────────────────────────────

  /// @notice ENS L2 Registry where humanens.eth subnames are minted as ERC-721 tokens.
  IL2Registry public immutable registry;

  /// @notice Address whose signatures attest that a World ID verification succeeded.
  address public backendSigner;

  /// @notice Address whose signatures attest L1 ENS ownership (from the CCIP-Read gateway).
  address public gatewaySigner;

  /// @notice EIP-3668 gateway URL template (e.g. "https://gw.example/{sender}/{data}.json").
  string public gatewayUrl;

  /// @dev World ID nullifier → namehash of the source ENS name (e.g. namehash("alice.eth"))
  mapping(bytes32 => bytes32) public nullifierToSourceNode;
  /// @dev Reverse: source namehash → nullifier (enforces 1:1 mapping)
  mapping(bytes32 => bytes32) public sourceNodeToNullifier;
  /// @dev source namehash → L1 ENS owner address at time of registration
  mapping(bytes32 => address) public sourceNodeToEnsOwner;
  /// @dev Agent subname node → parent's nullifier (for ownership checks)
  mapping(bytes32 => bytes32) public agentToParentNullifier;
  /// @dev Nullifier → list of agent subname nodes (for cleanup on link revoke/challenge)
  mapping(bytes32 => bytes32[]) internal nullifierAgentNodes;
  /// @dev keccak256(label) → source namehash (for label → link lookups)
  mapping(bytes32 => bytes32) public labelHashToSourceNode;

  /// @notice Maximum age (in seconds) for attestation/proof timestamps before they expire.
  uint256 constant MAX_AGE = 10 minutes;

  // ─── Events ──────────────────────────────────────────────────────────

  event LinkRegistered(string label, bytes32 sourceNode, bytes32 nullifierHash, address ensOwner);
  event LinkRevoked(string label, bytes32 sourceNode);
  event LinkChallenged(string label, bytes32 sourceNode, address challenger);
  event AgentCreated(string parentLabel, string agentLabel, address agentAddress);
  event AgentRevoked(string parentLabel, string agentLabel);

  // ─── Constructor ─────────────────────────────────────────────────────

  constructor(
    address _registry,
    address _backendSigner,
    address _gatewaySigner,
    string memory _gatewayUrl
  ) Ownable(msg.sender) {
    registry = IL2Registry(_registry);
    backendSigner = _backendSigner;
    gatewaySigner = _gatewaySigner;
    gatewayUrl = _gatewayUrl;
  }

  /// @dev Returns the gateway URL array for OffchainLookup.
  function _urls() internal view returns (string[] memory) {
    string[] memory urls = new string[](1);
    urls[0] = gatewayUrl;
    return urls;
  }

  // ─── Register Link (CCIP-Read) ──────────────────────────────────────

  /// @notice Step 1 of registration. Always reverts with OffchainLookup so the client
  ///         fetches a signed L1 ownership proof from the gateway, then calls registerLinkCallback.
  /// @param label The desired subname label (e.g. "alice" → alice.humanens.eth)
  /// @param sourceName The full L1 ENS name (e.g. "alice.eth") — gateway reads its text records
  /// @param sourceNode namehash(sourceName)
  /// @param attestationData abi.encode(nullifierHash, timestamp, backendSig) from the backend
  function registerLink(
    string calldata label,
    string calldata sourceName,
    bytes32 sourceNode,
    bytes calldata attestationData
  ) external view {
    revert OffchainLookup(
      address(this),
      _urls(),
      abi.encode(sourceNode, "humanens", sourceName),
      this.registerLinkCallback.selector,
      abi.encode(label, sourceNode, sourceName, attestationData)
    );
  }

  /// @notice Step 2 of registration. Called by the client with the gateway's signed response.
  ///         Verifies both backend (World ID) and gateway (L1 ownership) signatures, then mints
  ///         the subname on the L2 registry.
  /// @dev Security: callable by anyone, but both signature checks + uniqueness checks prevent abuse.
  /// @param response ABI-encoded gateway proof: (sourceNode, textRecordValue, ensOwner, timestamp, sig)
  /// @param extraData ABI-encoded original call context: (label, sourceNode, sourceName, attestationData)
  function registerLinkCallback(bytes calldata response, bytes calldata extraData) external {
    (
      string memory label,
      bytes32 sourceNode,
      string memory sourceName,
      bytes memory attestationData
    ) = abi.decode(extraData, (string, bytes32, string, bytes));

    bytes32 nullifierHash;
    address ensOwner;

    // Verify backend attestation (World ID)
    string memory level;
    {
      (bytes32 _nul, string memory _level, uint256 attTimestamp, bytes memory attSig) = abi.decode(
        attestationData,
        (bytes32, string, uint256, bytes)
      );
      nullifierHash = _nul;
      level = _level;
      require(block.timestamp <= attTimestamp + MAX_AGE, "Attestation expired");
      bytes32 attHash = keccak256(
        abi.encodePacked("register", nullifierHash, sourceNode, label, level, attTimestamp)
      );
      require(_recover(attHash, attSig) == backendSigner, "Bad backend sig");
    }

    // Verify gateway response (L1 ownership)
    {
      (
        bytes32 proofSourceNode,
        string memory value,
        address _ensOwner,
        uint256 proofTimestamp,
        bytes memory gatewaySig
      ) = abi.decode(response, (bytes32, string, address, uint256, bytes));
      ensOwner = _ensOwner;
      require(block.timestamp <= proofTimestamp + MAX_AGE, "Proof expired");
      require(proofSourceNode == sourceNode, "SourceNode mismatch");
      // Text record stores the nullifier hex string — parse and verify it matches
      bytes32 recordNullifier = _hexToBytes32(value);
      require(recordNullifier == nullifierHash, "Nullifier mismatch");
      bytes32 proofHash = keccak256(
        abi.encodePacked(proofSourceNode, value, ensOwner, proofTimestamp)
      );
      require(_recover(proofHash, gatewaySig) == gatewaySigner, "Bad gateway sig");
    }

    // If a link already exists for this source ENS name, auto-clear it if L1 owner changed
    // This enables implicit transfers: new owner just claims, old link is cleared automatically
    bytes32 existingNullifier = sourceNodeToNullifier[sourceNode];
    if (existingNullifier != bytes32(0)) {
      require(ensOwner != sourceNodeToEnsOwner[sourceNode], "Link exists (same owner)");
      // Owner changed on L1 — clear the stale link
      // Find old label from labelHashToSourceNode reverse lookup
      _clearLink(existingNullifier, sourceNode, label);
      bytes32 baseNode = registry.baseNode();
      bytes32 oldNode = registry.makeNode(baseNode, label);
      registry.burn(uint256(oldNode));
    }

    // One link per World ID nullifier
    require(nullifierToSourceNode[nullifierHash] == bytes32(0), "Nullifier used");

    // Store bidirectional mappings
    nullifierToSourceNode[nullifierHash] = sourceNode;
    sourceNodeToEnsOwner[sourceNode] = ensOwner;
    sourceNodeToNullifier[sourceNode] = nullifierHash;
    labelHashToSourceNode[keccak256(bytes(label))] = sourceNode;

    // Mint subname on L2 registry
    _mintSubname(label, ensOwner, level);

    emit LinkRegistered(label, sourceNode, nullifierHash, ensOwner);
  }

  /// @dev Mints a subname on the L2 registry with verification metadata.
  function _mintSubname(string memory label, address ensOwner, string memory level) internal {
    bytes32 baseNode = registry.baseNode();
    bytes32 node = registry.makeNode(baseNode, label);
    registry.createSubnode(baseNode, label, address(this), new bytes[](0));
    registry.setAddr(node, ensOwner);
    registry.setText(node, "world-id-level", level);
  }

  // ─── Revoke Link ─────────────────────────────────────────────────────

  /// @notice Allows the original registrant to voluntarily revoke their link.
  ///         Requires a fresh backend signature to prove continued World ID ownership.
  /// @param label The subname label (e.g. "alice")
  /// @param nullifierHash The World ID nullifier for this link
  /// @param timestamp Backend attestation timestamp (must be within MAX_AGE)
  /// @param sig Backend signature over ("revoke", sender, nullifier, sourceNode, label, timestamp)
  function revokeLink(
    string calldata label,
    bytes32 nullifierHash,
    uint256 timestamp,
    bytes calldata sig
  ) external {
    bytes32 sourceNode = nullifierToSourceNode[nullifierHash];
    require(sourceNode != bytes32(0), "No link");
    require(labelHashToSourceNode[keccak256(bytes(label))] == sourceNode, "Label mismatch");

    require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
    bytes32 h = keccak256(abi.encodePacked("revoke", nullifierHash, sourceNode, label, timestamp));
    require(_recover(h, sig) == backendSigner, "Bad backend sig");

    _clearLink(nullifierHash, sourceNode, label);

    bytes32 baseNode = registry.baseNode();
    bytes32 node = registry.makeNode(baseNode, label);
    registry.burn(uint256(node));

    emit LinkRevoked(label, sourceNode);
  }

  // ─── Challenge Stale Link (CCIP-Read) ────────────────────────────────

  /// @notice Anyone can challenge a link they believe is stale (L1 text record changed/removed).
  ///         Reverts with OffchainLookup — the gateway re-checks the current L1 state.
  /// @param label The subname label to challenge
  /// @param sourceName The full L1 ENS name (for gateway to read current state)
  function challengeLink(string calldata label, string calldata sourceName) external view {
    bytes32 sourceNode = labelHashToSourceNode[keccak256(bytes(label))];
    require(sourceNode != bytes32(0), "No link");

    bytes32 baseNode = registry.baseNode();
    bytes32 node = registry.makeNode(baseNode, label);

    revert OffchainLookup(
      address(this),
      _urls(),
      abi.encode(sourceNode, "humanens", sourceName),
      this.challengeLinkCallback.selector,
      abi.encode(msg.sender, label, node, sourceNode)
    );
  }

  /// @notice Challenge callback. Burns the subname if the L1 text record no longer matches
  ///         the stored nullifier (i.e. the bidirectional link is broken).
  /// @dev Security: callable by anyone, but gateway signature + on-chain nullifier check
  ///      ensure only genuinely stale links can be removed.
  /// @param response ABI-encoded gateway proof (same format as registerLinkCallback)
  /// @param extraData ABI-encoded: (challenger, label, node, sourceNode)
  function challengeLinkCallback(bytes calldata response, bytes calldata extraData) external {
    (address challenger, string memory label, , bytes32 sourceNode) = abi.decode(
      extraData,
      (address, string, bytes32, bytes32)
    );

    require(sourceNode != bytes32(0), "No link");

    // Re-derive node from label — don't trust extraData
    require(labelHashToSourceNode[keccak256(bytes(label))] == sourceNode, "Label mismatch");
    bytes32 node = registry.makeNode(registry.baseNode(), label);

    // Verify gateway response + check validity
    {
      (
        bytes32 proofSourceNode,
        string memory value,
        address ensOwner,
        uint256 proofTimestamp,
        bytes memory gatewaySig
      ) = abi.decode(response, (bytes32, string, address, uint256, bytes));
      require(block.timestamp <= proofTimestamp + MAX_AGE, "Proof expired");
      require(proofSourceNode == sourceNode, "SourceNode mismatch");
      bytes32 proofHash = keccak256(
        abi.encodePacked(proofSourceNode, value, ensOwner, proofTimestamp)
      );
      require(_recover(proofHash, gatewaySig) == gatewaySigner, "Bad gateway sig");

      // Check if the L1 text record nullifier still matches the stored one
      bytes32 storedNullifier = sourceNodeToNullifier[sourceNode];
      bool nullifierValid;
      {
        bytes memory valueBytes = bytes(value);
        if (valueBytes.length == 66) {
          bytes32 recordNullifier = _hexToBytes32(value);
          nullifierValid = recordNullifier == storedNullifier;
        }
        // If length != 66, nullifierValid stays false (record changed/cleared)
      }
      bool ownerChanged = ensOwner != sourceNodeToEnsOwner[sourceNode];
      require(!nullifierValid || ownerChanged, "Link still valid");
    }

    // Stale — clear state then burn (checks-effects-interactions)
    bytes32 nullifier = sourceNodeToNullifier[sourceNode];
    _clearLink(nullifier, sourceNode, label);
    registry.burn(uint256(node));

    emit LinkChallenged(label, sourceNode, challenger);
  }

  // ─── Agent Subnames ──────────────────────────────────────────────────

  /// @notice Creates an agent subname under a verified parent link.
  ///         e.g. "shopping-bot.alice.humanens.eth" where "alice" is the parent.
  /// @param parentLabel The parent subname label (must be a registered link)
  /// @param agentLabel The agent's label (e.g. "shopping-bot")
  /// @param agentAddress The address to set as the agent subname's ETH address
  /// @param nullifierHash The parent's World ID nullifier
  /// @param timestamp Backend attestation timestamp
  /// @param sig Backend signature over ("createAgent", sender, nullifier, parentLabel, agentLabel, agentAddress, timestamp)
  function createAgentSubname(
    string calldata parentLabel,
    string calldata agentLabel,
    address agentAddress,
    string calldata ensip25Key,
    bytes32 nullifierHash,
    uint256 timestamp,
    bytes calldata sig
  ) external {
    {
      require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
      bytes32 h = keccak256(
        abi.encodePacked(
          "createAgent",
          nullifierHash,
          parentLabel,
          agentLabel,
          agentAddress,
          ensip25Key,
          timestamp
        )
      );
      require(_recover(h, sig) == backendSigner, "Bad backend sig");
      require(nullifierToSourceNode[nullifierHash] != bytes32(0), "No parent link");
    }

    require(
      labelHashToSourceNode[keccak256(bytes(parentLabel))] == nullifierToSourceNode[nullifierHash],
      "Parent label mismatch"
    );

    bytes32 baseNode = registry.baseNode();
    bytes32 parentNode = registry.makeNode(baseNode, parentLabel);
    bytes32 agentNode = registry.makeNode(parentNode, agentLabel);
    bytes32 existingNullifier = agentToParentNullifier[agentNode];
    require(
      existingNullifier == bytes32(0) || nullifierToSourceNode[existingNullifier] == bytes32(0),
      "Agent exists"
    );

    // Burn stale token if re-creating after parent revoke
    if (existingNullifier != bytes32(0)) {
      registry.burn(uint256(agentNode));
    }

    agentToParentNullifier[agentNode] = nullifierHash;
    nullifierAgentNodes[nullifierHash].push(agentNode);

    registry.createSubnode(parentNode, agentLabel, address(this), new bytes[](0));
    registry.setAddr(agentNode, agentAddress);

    if (bytes(ensip25Key).length > 0) {
      registry.setText(agentNode, ensip25Key, "1");
    }

    emit AgentCreated(parentLabel, agentLabel, agentAddress);
  }

  /// @notice Revokes an agent subname. Only the parent link's registrant can call this.
  /// @param parentLabel The parent subname label
  /// @param agentLabel The agent subname label to revoke
  /// @param nullifierHash The parent's World ID nullifier
  /// @param timestamp Backend attestation timestamp
  /// @param sig Backend signature over ("revokeAgent", sender, nullifier, parentLabel, agentLabel, timestamp)
  function revokeAgentSubname(
    string calldata parentLabel,
    string calldata agentLabel,
    bytes32 nullifierHash,
    uint256 timestamp,
    bytes calldata sig
  ) external {
    require(block.timestamp <= timestamp + MAX_AGE, "Attestation expired");
    bytes32 h = keccak256(
      abi.encodePacked("revokeAgent", nullifierHash, parentLabel, agentLabel, timestamp)
    );
    require(_recover(h, sig) == backendSigner, "Bad backend sig");

    bytes32 baseNode = registry.baseNode();
    bytes32 parentNode = registry.makeNode(baseNode, parentLabel);
    bytes32 agentNode = registry.makeNode(parentNode, agentLabel);
    require(agentToParentNullifier[agentNode] == nullifierHash, "Not owner");

    delete agentToParentNullifier[agentNode];
    _removeAgentNode(nullifierHash, agentNode);
    registry.burn(uint256(agentNode));

    emit AgentRevoked(parentLabel, agentLabel);
  }

  // ─── Admin ───────────────────────────────────────────────────────────

  /// @notice Update the backend signer address (for World ID attestations).
  function setBackendSigner(address _s) external onlyOwner {
    backendSigner = _s;
  }

  /// @notice Update the gateway signer address (for L1 ownership proofs).
  function setGatewaySigner(address _s) external onlyOwner {
    gatewaySigner = _s;
  }

  /// @notice Update the CCIP-Read gateway URL.
  function setGatewayUrl(string calldata _url) external onlyOwner {
    gatewayUrl = _url;
  }

  // ─── Internal ────────────────────────────────────────────────────────

  /// @dev Accept ERC-721 safe transfers (required by L2 Registry's _safeMint).
  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return IERC721Receiver.onERC721Received.selector;
  }

  /// @dev Recovers the signer of an eth_sign-style signed message.
  function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
    bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    (bytes32 r, bytes32 s, uint8 v) = _splitSig(sig);
    address signer = ecrecover(ethHash, v, r, s);
    require(signer != address(0), "Invalid sig");
    return signer;
  }

  /// @dev Splits a 65-byte signature into (r, s, v) components.
  function _splitSig(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
    require(sig.length == 65, "Bad sig len");
    assembly {
      r := mload(add(sig, 32))
      s := mload(add(sig, 64))
      v := byte(0, mload(add(sig, 96)))
    }
    if (v < 27) v += 27;
  }

  /// @dev Clears all state for a link + burns all its agent subnames from the registry.
  function _clearLink(bytes32 nullifier, bytes32 sourceNode, string memory label) internal {
    // Burn all agent subnames under this nullifier
    bytes32[] storage agents = nullifierAgentNodes[nullifier];
    for (uint256 i = 0; i < agents.length; i++) {
      if (agentToParentNullifier[agents[i]] != bytes32(0)) {
        delete agentToParentNullifier[agents[i]];
        registry.burn(uint256(agents[i]));
      }
    }
    delete nullifierAgentNodes[nullifier];

    delete nullifierToSourceNode[nullifier];
    delete sourceNodeToEnsOwner[sourceNode];
    delete sourceNodeToNullifier[sourceNode];
    delete labelHashToSourceNode[keccak256(bytes(label))];
  }

  /// @dev Removes an agent node from nullifierAgentNodes using swap-and-pop.
  ///      Prevents unbounded gas growth from repeated agent create/revoke cycles.
  function _removeAgentNode(bytes32 nullifier, bytes32 agentNode) internal {
    bytes32[] storage agents = nullifierAgentNodes[nullifier];
    for (uint256 i = 0; i < agents.length; i++) {
      if (agents[i] == agentNode) {
        agents[i] = agents[agents.length - 1];
        agents.pop();
        return;
      }
    }
  }

  /// @dev Parses a 66-char hex string ("0x" + 64 hex chars) into bytes32.
  function _hexToBytes32(string memory s) internal pure returns (bytes32 result) {
    bytes memory b = bytes(s);
    require(b.length == 66, "Bad hex length");
    require(b[0] == "0" && (b[1] == "x" || b[1] == "X"), "No 0x prefix");
    for (uint256 i = 2; i < 66; i++) {
      uint8 hi = _fromHexChar(uint8(b[i]));
      i++;
      uint8 lo = _fromHexChar(uint8(b[i]));
      result = bytes32(
        uint256(result) | (uint256(uint8((hi << 4) | lo)) << (8 * (31 - ((i - 2) / 2))))
      );
    }
  }

  /// @dev Converts a single ASCII hex character to its numeric value (0-15).
  function _fromHexChar(uint8 c) internal pure returns (uint8) {
    if (c >= 48 && c <= 57) return c - 48; // 0-9
    if (c >= 97 && c <= 102) return c - 87; // a-f
    if (c >= 65 && c <= 70) return c - 55; // A-F
    revert("Bad hex char");
  }
}
