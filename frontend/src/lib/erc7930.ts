/**
 * ERC-7930 interoperable address encoding for EVM chains.
 * Format: 0x + namespace(2) + ULEB128(chainId) + addressLength(1) + address(20)
 * Namespace 0x0001 = EVM
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
] as const;

/**
 * Encode an unsigned integer as ULEB128.
 */
function encodeULEB128(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

/**
 * Encode an EVM address as an ERC-7930 interoperable address.
 */
export function encodeERC7930(chainId: number, address: string): string {
  const addr = address.replace("0x", "").toLowerCase();
  const chainBytes = encodeULEB128(chainId);
  const hex =
    "0001" +
    Array.from(chainBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") +
    "14" +
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
