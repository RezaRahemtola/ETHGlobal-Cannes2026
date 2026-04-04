"use client";

import { useState } from "react";
import { createPublicClient, http, parseAbi } from "viem";

const AGENTBOOK_ADDRESS = "0xA23aB2712eA7BBa896930544C7d6636a96b944dA" as const;
const AGENTBOOK_RELAY = "https://x402-worldchain.vercel.app/register";

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

type AgentBookStatus = "idle" | "verifying" | "submitting" | "success" | "error";

/**
 * Hook for registering an agent in AgentBook.
 * Uses the AgentKit relay for gasless submission.
 */
export function useAgentBookRegister() {
  const [status, setStatus] = useState<AgentBookStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function registerAgent(agentAddress: `0x${string}`) {
    setStatus("verifying");
    setError(null);

    try {
      // Get next nonce from AgentBook contract
      const nonce = await client.readContract({
        address: AGENTBOOK_ADDRESS,
        abi: agentBookAbi,
        functionName: "getNextNonce",
        args: [agentAddress],
      });

      // Build World ID verification request
      const { MiniKit } = await import("@worldcoin/minikit-js");

      const verifyPayload = {
        action: "agentbook-registration",
        signal: agentAddress,
      };

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);

      if (finalPayload.status !== "success") {
        throw new Error("World ID verification failed");
      }

      setStatus("submitting");

      // Submit to AgentKit relay (gasless)
      const relayResponse = await fetch(AGENTBOOK_RELAY, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentAddress,
          nonce: nonce.toString(),
          proof: finalPayload,
        }),
      });

      if (!relayResponse.ok) {
        const errData = await relayResponse.json().catch(() => ({}));
        throw new Error(errData.error || "AgentBook relay submission failed");
      }

      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register in AgentBook");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return { registerAgent, status, error, reset };
}
