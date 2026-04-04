"use client";

import { useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { namehash } from "viem";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL } from "@/lib/constants";

type Status = "idle" | "attesting" | "sending" | "success" | "error";

export function useRevokeLink() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function revokeLink(args: { label: string; idkitResult: unknown }) {
    setStatus("attesting");
    setError(null);

    try {
      const sourceNode = namehash(`${args.label}.eth`) as `0x${string}`;

      const attResponse = await fetch(`${BACKEND_URL}/api/verify-and-sign-revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: args.label,
          sourceNode,
          idkitResult: args.idkitResult,
        }),
      });

      if (!attResponse.ok) {
        const body = await attResponse.json().catch(() => ({}));
        throw new Error(body.error || "Backend attestation failed");
      }

      const { nullifierHash, timestamp, signature } = (await attResponse.json()) as {
        nullifierHash: `0x${string}`;
        timestamp: string;
        signature: `0x${string}`;
      };

      setStatus("sending");

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: HUMANENS_LINKER_ADDRESS,
            abi: humanENSLinkerABI,
            functionName: "revokeLink",
            args: [args.label, nullifierHash, BigInt(timestamp), signature],
          },
        ],
      });

      if (finalPayload.status !== "success") throw new Error("Transaction failed");

      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unlink domain");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return { revokeLink, status, error, reset };
}
