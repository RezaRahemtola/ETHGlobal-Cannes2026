"use client";

import { useState, useCallback } from "react";
import { BACKEND_URL, WORLD_APP_ID, WORLD_ACTION_ID, WORLD_RP_ID } from "@/lib/constants";
import type { RpContext } from "@worldcoin/idkit";

export function useIdkitVerify() {
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [isLoadingRp, setIsLoadingRp] = useState(false);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRpContext = useCallback(async () => {
    setIsLoadingRp(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/rp-signature`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: WORLD_ACTION_ID }),
      });
      if (!res.ok) throw new Error("Failed to get RP signature");
      const data = await res.json();
      setRpContext({
        rp_id: WORLD_RP_ID,
        nonce: data.nonce,
        created_at: data.created_at,
        expires_at: data.expires_at,
        signature: data.sig,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "RP signature failed");
    } finally {
      setIsLoadingRp(false);
    }
  }, []);

  const verifyNullifier = useCallback(async (idkitResult: unknown) => {
    const res = await fetch(`${BACKEND_URL}/api/verify-nullifier`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idkitResult }),
    });
    if (!res.ok) throw new Error("World ID verification failed");
    const { nullifierHash } = await res.json();
    setNullifier(nullifierHash);
    return nullifierHash as string;
  }, []);

  return {
    rpContext,
    isLoadingRp,
    fetchRpContext,
    nullifier,
    verifyNullifier,
    error,
    appId: WORLD_APP_ID,
    action: WORLD_ACTION_ID,
  };
}
