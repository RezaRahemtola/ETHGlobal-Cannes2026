"use client";

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { HUMANENS_LINKER_ADDRESS } from "@/lib/constants";
import { humanENSLinkerABI } from "@/lib/contracts";

const SESSION_KEY = "humanens_nullifier";

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

/**
 * Resolves a nullifier to registered parent labels by:
 * 1. Calling nullifierToSourceNode on contract
 * 2. Finding the label from LinkRegistered events matching that sourceNode
 */
async function resolveLabels(nullifierHash: `0x${string}`): Promise<string[]> {
  // Check if this nullifier has a registered link
  const sourceNode = await client.readContract({
    address: HUMANENS_LINKER_ADDRESS,
    abi: humanENSLinkerABI,
    functionName: "nullifierToSourceNode",
    args: [nullifierHash],
  });

  if (sourceNode === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return [];
  }

  // Find the label from LinkRegistered events
  const logs = await client.getLogs({
    address: HUMANENS_LINKER_ADDRESS,
    event: parseAbiItem(
      "event LinkRegistered(string label, bytes32 sourceNode, bytes32 nullifierHash, address ensOwner)",
    ),
    fromBlock: BigInt(0),
    toBlock: "latest",
  });

  const labels = logs
    .filter((l) => l.args.sourceNode === sourceNode)
    .map((l) => l.args.label!);

  return labels;
}

export function useMyLabels() {
  const [nullifier, setNullifier] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(SESSION_KEY);
    }
    return null;
  });
  const [labels, setLabels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const saveNullifier = useCallback((hash: string) => {
    sessionStorage.setItem(SESSION_KEY, hash);
    setNullifier(hash);
  }, []);

  // Resolve labels whenever nullifier changes
  useEffect(() => {
    if (!nullifier) return;

    setIsLoading(true);
    resolveLabels(nullifier as `0x${string}`)
      .then(setLabels)
      .catch(() => setLabels([]))
      .finally(() => setIsLoading(false));
  }, [nullifier]);

  return {
    nullifier,
    labels,
    isLoading,
    saveNullifier,
    needsVerify: !nullifier,
  };
}
