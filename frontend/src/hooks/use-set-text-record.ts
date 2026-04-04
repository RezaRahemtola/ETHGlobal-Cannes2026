"use client";

import { useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { namehash } from "viem";
import { mainnet } from "wagmi/chains";
import { ensClient } from "@/lib/ens";
import { useState } from "react";

// NameWrapper on mainnet
const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BBdBE25686401" as const;

// Known Public Resolver versions
const PUBLIC_RESOLVER_V2 = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63".toLowerCase();

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
    name: "owner",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
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
      const node = namehash(ensName);

      // Read registry owner and resolver directly from the registry
      const [registryOwner, resolver] = await Promise.all([
        ensClient.readContract({
          address: ENS_REGISTRY,
          abi: registryABI,
          functionName: "owner",
          args: [node],
        }) as Promise<`0x${string}`>,
        ensClient.readContract({
          address: ENS_REGISTRY,
          abi: registryABI,
          functionName: "resolver",
          args: [node],
        }) as Promise<`0x${string}`>,
      ]);

      if (!resolver || resolver === "0x0000000000000000000000000000000000000000") {
        setResolverError(`No resolver set for ${ensName}. Please set a resolver in the ENS app first.`);
        return;
      }

      const isWrapped = registryOwner.toLowerCase() === NAME_WRAPPER.toLowerCase();
      const isResolverV2 = resolver.toLowerCase() === PUBLIC_RESOLVER_V2;

      // Wrapped name with old resolver can't authorize the user
      if (isWrapped && !isResolverV2) {
        setResolverError(
          `${ensName} is wrapped but uses an old resolver. Please update the resolver to the Latest Public Resolver in the ENS app (manage → more → resolver).`,
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
