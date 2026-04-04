"use client";

import { useState } from "react";
import { getEnsTextRecord } from "@/lib/ens";

export interface VerificationResult {
  name: string;
  humanensSubname: string | null;
  isVerified: boolean;
  worldIdLevel: string | null;
  reverseRecordValid: boolean;
}

export function useVerifyName() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(name: string) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const label = name.replace(/\.eth$/, "");
      const subname = `${label}.humanens.eth`;

      const [level, reverseRecord] = await Promise.all([
        getEnsTextRecord(subname, "world-id-level").catch(() => null),
        getEnsTextRecord(`${label}.eth`, "humanens").catch(() => null),
      ]);

      const reverseValid = !!reverseRecord;
      const subnameExists = !!level;

      setResult({
        name: `${label}.eth`,
        humanensSubname: subnameExists ? subname : null,
        isVerified: subnameExists && reverseValid,
        worldIdLevel: level,
        reverseRecordValid: reverseValid,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  }

  return { verify, result, isLoading, error };
}
