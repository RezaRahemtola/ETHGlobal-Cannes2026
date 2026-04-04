"use client";

import { useState } from "react";
import { createPublicClient, http, parseAbi } from "viem";
import { MiniKit } from "@worldcoin/minikit-js";

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
      console.log("[agentbook] Starting registration for", agentAddress);

      // Get next nonce from AgentBook contract
      const nonce = await client.readContract({
        address: AGENTBOOK_ADDRESS,
        abi: agentBookAbi,
        functionName: "getNextNonce",
        args: [agentAddress],
      });

      console.log("[agentbook] Nonce:", nonce.toString());

      // World ID verification via MiniKit
      const verifyPayload = {
        action: "agentbook-registration",
        signal: agentAddress,
      };

      console.log("[agentbook] Verifying with World ID...", verifyPayload);
      const { finalPayload: verifyResult } = await MiniKit.commandsAsync.verify(verifyPayload);
      console.log("[agentbook] Verify response:", JSON.stringify(verifyResult));

      if (verifyResult.status !== "success") {
        throw new Error("World ID verification failed");
      }

      setStatus("submitting");
      console.log("[agentbook] Sending register tx...");

      // Extract proof fields from verify result
      const vr = verifyResult as unknown as {
        merkle_root: string;
        nullifier_hash: string;
        proof: string;
      };
      const proofChunks = Array.from({ length: 8 }, (_, i) =>
        BigInt("0x" + vr.proof.slice(2 + i * 64, 2 + (i + 1) * 64))
      );

      // Call AgentBook.register() directly via MiniKit
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: AGENTBOOK_ADDRESS,
            abi: [
              {
                type: "function",
                name: "register",
                inputs: [
                  { name: "agent", type: "address" },
                  { name: "root", type: "uint256" },
                  { name: "nonce", type: "uint256" },
                  { name: "nullifierHash", type: "uint256" },
                  { name: "proof", type: "uint256[8]" },
                ],
                outputs: [],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "register",
            args: [
              agentAddress,
              BigInt(vr.merkle_root),
              nonce,
              BigInt(vr.nullifier_hash),
              proofChunks,
            ],
          },
        ],
      });

      console.log("[agentbook] Tx response:", JSON.stringify(finalPayload));

      if (finalPayload.status !== "success") {
        throw new Error("AgentBook registration transaction failed");
      }

      setStatus("success");
    } catch (e) {
      console.error("[agentbook] Error:", e);
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
