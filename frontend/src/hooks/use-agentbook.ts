import { createPublicClient, http, parseAbi } from "viem";

const AGENTBOOK_ADDRESS = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA" as const;

const worldchain = {
  id: 480 as const,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
};

const client = createPublicClient({
  chain: worldchain,
  transport: http(),
});

const agentBookAbi = parseAbi([
  "function lookupHuman(address) view returns (uint256)",
  "function getNextNonce(address) view returns (uint256)",
]);

/**
 * Check if an agent address is registered in AgentBook.
 * Returns the nullifier hash (non-zero = registered).
 */
export async function lookupAgentBook(agentAddress: `0x${string}`): Promise<bigint> {
  return client.readContract({
    address: AGENTBOOK_ADDRESS,
    abi: agentBookAbi,
    functionName: "lookupHuman",
    args: [agentAddress],
  });
}
