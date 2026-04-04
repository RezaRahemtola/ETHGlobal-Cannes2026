"use client";

import { useState } from "react";
import { MiniKit, type MiniAppSendTransactionSuccessPayload } from "@worldcoin/minikit-js";
import { namehash } from "viem";
import { buildRegisterLinkCallbackArgs } from "@/lib/ccip-read";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL } from "@/lib/constants";

type Status =
  | "idle"
  | "verifying"
  | "attesting"
  | "ccip"
  | "sending"
  | "confirming"
  | "success"
  | "error";

export function useRegisterLink() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function register(args: { label: string; idkitResult: unknown; level: string }) {
    setStatus("attesting");
    setError(null);

    try {
      const sourceName = `${args.label}.eth`;
      const sourceNode = namehash(sourceName) as `0x${string}`;
      console.log("[claim] sourceName:", sourceName, "sourceNode:", sourceNode);

      // Step 1: Get backend attestation
      console.log("[claim] Step 1: fetching backend attestation...");
      const attResponse = await fetch(`${BACKEND_URL}/api/verify-and-attest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: args.label,
          sourceNode,
          level: args.level,
          idkitResult: args.idkitResult,
        }),
      });

      if (!attResponse.ok) {
        const body = await attResponse.json().catch(() => ({}));
        throw new Error(body.error || `Backend attestation failed (${attResponse.status})`);
      }

      const { attestationData } = (await attResponse.json()) as {
        attestationData: `0x${string}`;
      };

      console.log("[claim] Step 1 done, got attestationData:", attestationData.slice(0, 20) + "...");

      // Step 2: CCIP-Read orchestration
      setStatus("ccip");
      console.log("[claim] Step 2: CCIP-Read...");

      const [response, extraData] = await buildRegisterLinkCallbackArgs({
        label: args.label,
        sourceName,
        sourceNode,
        attestationData,
      });

      console.log("[claim] Step 2 done, response:", response.slice(0, 20) + "...");
      console.log("[claim] extraData:", extraData.slice(0, 20) + "...");

      // Step 3: Send via MiniKit
      setStatus("sending");
      console.log("[claim] Step 3: sending tx to", HUMANENS_LINKER_ADDRESS);

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: HUMANENS_LINKER_ADDRESS,
            abi: humanENSLinkerABI,
            functionName: "registerLinkCallback",
            args: [response, extraData],
          },
        ],
      });

      console.log("[claim] MiniKit response:", JSON.stringify(finalPayload));
      if (finalPayload.status !== "success") {
        const msg =
          (finalPayload as Record<string, unknown>).error_code ||
          (finalPayload as Record<string, unknown>).message ||
          "Transaction failed";
        throw new Error(String(msg));
      }

      setStatus("success");

      // Poll for tx hash in background (non-blocking)
      const successPayload = finalPayload as MiniAppSendTransactionSuccessPayload;
      (async () => {
        for (let i = 0; i < 30; i++) {
          try {
            const statusRes = await fetch(
              `https://developer.world.org/api/v2/minikit/transaction/${successPayload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_WORLD_APP_ID}`,
            );
            const statusData = await statusRes.json();
            if (statusData.transactionHash) {
              setTxHash(statusData.transactionHash);
              return;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 2000));
        }
      })();
    } catch (e) {
      console.error("[claim] Error:", e);
      setError(e instanceof Error ? e.message : "Registration failed");
      setStatus("error");
    }
  }

  return { register, status, error, txHash };
}
