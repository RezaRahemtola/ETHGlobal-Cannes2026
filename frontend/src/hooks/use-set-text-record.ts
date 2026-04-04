"use client";

import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { namehash } from "viem";
import { mainnet } from "wagmi/chains";
import { getEnsResolver } from "@/lib/ens";
import { useState } from "react";

const resolverABI = [
  {
    type: "function",
    name: "setText",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export function useSetTextRecord() {
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { switchChainAsync } = useSwitchChain();
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [isResolvingResolver, setIsResolvingResolver] = useState(false);

  const isPending = isWritePending || isResolvingResolver;
  const error = writeError || (resolverError ? new Error(resolverError) : null);

  async function setTextRecord(ensName: string, value: string) {
    setResolverError(null);
    setIsResolvingResolver(true);

    try {
      const resolver = await getEnsResolver(ensName);
      if (!resolver) {
        setResolverError(`No resolver found for ${ensName}`);
        return;
      }

      await switchChainAsync({ chainId: mainnet.id });

      const node = namehash(ensName);
      writeContract({
        chainId: mainnet.id,
        address: resolver,
        abi: resolverABI,
        functionName: "setText",
        args: [node, "humanens", value],
      });
    } catch (e) {
      setResolverError(e instanceof Error ? e.message : "Failed to resolve ENS name");
    } finally {
      setIsResolvingResolver(false);
    }
  }

  return { setTextRecord, isPending, isConfirming, isSuccess, hash, error };
}
