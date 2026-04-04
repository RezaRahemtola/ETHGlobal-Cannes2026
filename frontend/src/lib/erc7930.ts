/**
 * ERC-7930 interoperable address encoding for EVM chains.
 * Format: version(2) + chainType(2) + chainRefLen(1) + chainRef(variable) + addrLen(1) + addr(variable)
 * Version 0x0001, ChainType 0x0000 = EVM
 */

const ERC8004_REGISTRY = "8004A169FB4a3325136EB29fA0ceB6D2e539a432";

/** Supported chains where ERC-8004 Identity Registry is deployed */
export const ERC8004_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 137, name: "Polygon" },
  { id: 59144, name: "Linea" },
  { id: 534352, name: "Scroll" },
  { id: 43114, name: "Avalanche" },
  { id: 56, name: "BSC" },
  { id: 100, name: "Gnosis" },
  { id: 42220, name: "Celo" },
  { id: 5000, name: "Mantle" },
  { id: 167000, name: "Taiko" },
  { id: 1868, name: "Soneium" },
  { id: 2741, name: "Abstract" },
] as const;

/**
 * Encode an EVM address as an ERC-7930 interoperable address.
 */
export function encodeERC7930(chainId: number, address: string): string {
  const addr = address.replace("0x", "").toLowerCase();
  // Encode chain ID as minimal big-endian bytes
  const chainRefBytes: number[] = [];
  let id = chainId;
  do {
    chainRefBytes.unshift(id & 0xff);
    id = id >>> 8;
  } while (id > 0);
  const hex =
    "0001" + // version
    "0000" + // chainType (EVM)
    chainRefBytes.length.toString(16).padStart(2, "0") + // chainRefLen
    chainRefBytes.map((b) => b.toString(16).padStart(2, "0")).join("") + // chainRef
    "14" + // addrLen (20)
    addr;
  return "0x" + hex;
}

/**
 * Build the ENSIP-25 text record key for an ERC-8004 agent.
 * Format: agent-registration[<erc7930-encoded-registry>][<agentId>]
 */
export function buildENSIP25Key(chainId: number, agentId: string): string {
  const erc7930 = encodeERC7930(chainId, "0x" + ERC8004_REGISTRY);
  return `agent-registration[${erc7930}][${agentId}]`;
}
