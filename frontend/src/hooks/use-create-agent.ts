"use client";

import { useState } from "react";
import { MiniKit, type MiniAppSendTransactionSuccessPayload } from "@worldcoin/minikit-js";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL } from "@/lib/constants";

type Status = "idle" | "attesting" | "sending" | "confirming" | "success" | "error";

export function useCreateAgent() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function createAgent(args: {
    parentLabel: string;
    agentLabel: string;
    agentAddress: `0x${string}`;
    idkitResult: unknown;
    ensip25Key?: string;
  }) {
    setStatus("attesting");
    setError(null);

    try {
      const ensip25Key = args.ensip25Key || "";

      const attResponse = await fetch(`${BACKEND_URL}/api/verify-and-sign-agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentLabel: args.parentLabel,
          agentLabel: args.agentLabel,
          agentAddress: args.agentAddress,
          ensip25Key,
          idkitResult: args.idkitResult,
        }),
      });

      if (!attResponse.ok) throw new Error("Backend attestation failed");

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
            functionName: "createAgentSubname",
            args: [
              args.parentLabel,
              args.agentLabel,
              args.agentAddress,
              ensip25Key,
              nullifierHash,
              BigInt(timestamp),
              signature,
            ],
          },
        ],
      });

      if (finalPayload.status !== "success") throw new Error("Transaction failed");

      const successPayload = finalPayload as MiniAppSendTransactionSuccessPayload;

      setStatus("confirming");
      let attempts = 0;
      while (attempts < 30) {
        const statusRes = await fetch(
          `https://developer.world.org/api/v2/minikit/transaction/${successPayload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_WORLD_APP_ID}`,
        );
        const statusData = await statusRes.json();
        if (statusData.transactionStatus === "confirmed") {
          setStatus("success");
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create agent");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return { createAgent, status, error, reset };
}
