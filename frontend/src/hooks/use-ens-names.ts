"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getEnsNamesForAddress } from "@/lib/ens";

export function useEnsNames() {
  const { address } = useAccount();
  const [names, setNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setNames([]);
      return;
    }

    setIsLoading(true);
    getEnsNamesForAddress(address)
      .then(setNames)
      .catch(() => setNames([]))
      .finally(() => setIsLoading(false));
  }, [address]);

  return { names, isLoading };
}
