import { HUMANENS_LINKER_ADDRESS } from "./constants";

export const humanENSLinkerABI = [
  {
    type: "function",
    name: "registerLink",
    inputs: [
      { name: "label", type: "string" },
      { name: "sourceName", type: "string" },
      { name: "sourceNode", type: "bytes32" },
      { name: "attestationData", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerLinkCallback",
    inputs: [
      { name: "response", type: "bytes" },
      { name: "extraData", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeLink",
    inputs: [
      { name: "label", type: "string" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createAgentSubname",
    inputs: [
      { name: "parentLabel", type: "string" },
      { name: "agentLabel", type: "string" },
      { name: "agentAddress", type: "address" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAgentSubname",
    inputs: [
      { name: "parentLabel", type: "string" },
      { name: "agentLabel", type: "string" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "subnameExists",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nullifierToSourceNode",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sourceNodeToNullifier",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "OffchainLookup",
    inputs: [
      { name: "sender", type: "address" },
      { name: "urls", type: "string[]" },
      { name: "callData", type: "bytes" },
      { name: "callbackFunction", type: "bytes4" },
      { name: "extraData", type: "bytes" },
    ],
  },
  {
    type: "event",
    name: "LinkRegistered",
    inputs: [
      { name: "label", type: "string", indexed: false },
      { name: "sourceNode", type: "bytes32", indexed: false },
      { name: "nullifierHash", type: "bytes32", indexed: false },
      { name: "registrant", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentCreated",
    inputs: [
      { name: "parentLabel", type: "string", indexed: false },
      { name: "agentLabel", type: "string", indexed: false },
      { name: "agentAddress", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentRevoked",
    inputs: [
      { name: "parentLabel", type: "string", indexed: false },
      { name: "agentLabel", type: "string", indexed: false },
    ],
  },
] as const;

export const linkerContract = {
  address: HUMANENS_LINKER_ADDRESS,
  abi: humanENSLinkerABI,
} as const;
