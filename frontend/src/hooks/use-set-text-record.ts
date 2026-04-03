"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { namehash } from "viem";

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

// ENS Public Resolver on mainnet
const ENS_PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";

export function useSetTextRecord() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function setTextRecord(ensName: string) {
    const label = ensName.replace(/\.eth$/, "");
    const value = `${label}.humanens.eth`;
    const node = namehash(ensName);

    writeContract({
      address: ENS_PUBLIC_RESOLVER,
      abi: resolverABI,
      functionName: "setText",
      args: [node, "humanens", value],
    });
  }

  return { setTextRecord, isPending, isConfirming, isSuccess, hash, error };
}
