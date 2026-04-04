"use client";

import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { namehash } from "viem";
import { mainnet } from "wagmi/chains";
import { ensClient } from "@/lib/ens";
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

const registryABI = [
  {
    type: "function",
    name: "resolver",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

export function useSetTextRecord() {
  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();
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
      const node = namehash(ensName);

      // Read resolver directly from the ENS registry (not via ensjs findResolver which may return inherited ones)
      const resolver = (await ensClient.readContract({
        address: ENS_REGISTRY,
        abi: registryABI,
        functionName: "resolver",
        args: [node],
      })) as `0x${string}`;

      if (!resolver || resolver === "0x0000000000000000000000000000000000000000") {
        setResolverError(
          `No resolver set for ${ensName}. Please set a resolver in the ENS app first.`,
        );
        return;
      }

      await switchChainAsync({ chainId: mainnet.id });

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
