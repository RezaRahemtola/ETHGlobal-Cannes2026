"use client";

import { useState } from "react";
import { getEnsTextRecord } from "@/lib/ens";

export interface VerificationResult {
  name: string;
  humanensSubname: string | null;
  isVerified: boolean;
  worldIdLevel: string | null;
  sourceName: string | null;
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

      const [verified, level, source] = await Promise.all([
        getEnsTextRecord(subname, "world-id-verified").catch(() => null),
        getEnsTextRecord(subname, "world-id-level").catch(() => null),
        getEnsTextRecord(subname, "source-name").catch(() => null),
      ]);

      const reverseRecord = await getEnsTextRecord(`${label}.eth`, "humanens").catch(() => null);
      const reverseValid = reverseRecord === subname;

      setResult({
        name: `${label}.eth`,
        humanensSubname: verified ? subname : null,
        isVerified: verified === "true" && reverseValid,
        worldIdLevel: level,
        sourceName: source,
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
