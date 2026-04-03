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

  async function register(args: {
    label: string;
    idkitResult: {
      nullifier_hash: string;
      proof: string;
      merkle_root: string;
      verification_level: string;
    };
  }) {
    setStatus("attesting");
    setError(null);

    try {
      const sourceName = `${args.label}.eth`;
      const sourceNode = namehash(sourceName) as `0x${string}`;

      // Step 1: Get backend attestation
      const attResponse = await fetch(`${BACKEND_URL}/api/attest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: args.label,
          sourceNode,
          idkitResult: args.idkitResult,
        }),
      });

      if (!attResponse.ok) throw new Error("Backend attestation failed");

      const { attestationData } = (await attResponse.json()) as {
        attestationData: `0x${string}`;
      };

      // Step 2: CCIP-Read orchestration
      setStatus("ccip");
      const sender = MiniKit.user.walletAddress as `0x${string}`;

      const [response, extraData] = await buildRegisterLinkCallbackArgs({
        label: args.label,
        sourceName,
        sourceNode,
        attestationData,
        sender,
      });

      // Step 3: Send via MiniKit
      setStatus("sending");

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

      if (finalPayload.status !== "success") throw new Error("Transaction failed");

      const successPayload = finalPayload as MiniAppSendTransactionSuccessPayload;

      // Step 4: Wait for confirmation
      setStatus("confirming");
      setTxHash(successPayload.transaction_id);

      let attempts = 0;
      while (attempts < 30) {
        const statusRes = await fetch(
          `https://developer.world.org/api/v2/minikit/transaction/${successPayload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_WORLD_APP_ID}`,
        );
        const statusData = await statusRes.json();
        if (statusData.transactionStatus === "confirmed") {
          setTxHash(statusData.transactionHash ?? successPayload.transaction_id);
          setStatus("success");
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }

      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
      setStatus("error");
    }
  }

  return { register, status, error, txHash };
}
