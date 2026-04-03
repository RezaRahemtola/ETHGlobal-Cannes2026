"use client";

import { useState } from "react";
import {
  MiniKit,
  VerificationLevel,
  type MiniAppVerifyActionSuccessPayload,
} from "@worldcoin/minikit-js";
import { MiniKitGate } from "@/components/minikit-gate";
import { StepIndicator } from "@/components/step-indicator";
import { useRegisterLink } from "@/hooks/use-register-link";
import { WORLD_ACTION_ID } from "@/lib/constants";
import Link from "next/link";

function RegisterFlow() {
  const [label, setLabel] = useState("");
  const { register, status, error, txHash } = useRegisterLink();

  const statusMessages: Record<string, string> = {
    idle: "",
    verifying: "Verifying with World ID...",
    attesting: "Getting backend attestation...",
    ccip: "Verifying ENS ownership...",
    sending: "Confirm in World App...",
    confirming: "Confirming transaction...",
    success: "",
    error: "",
  };

  async function handleVerifyAndRegister() {
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: WORLD_ACTION_ID,
      verification_level: VerificationLevel.Orb,
    });

    if (finalPayload.status !== "success") return;

    const successPayload = finalPayload as MiniAppVerifyActionSuccessPayload;
    const idkitResult = {
      nullifier_hash: successPayload.nullifier_hash,
      proof: successPayload.proof,
      merkle_root: successPayload.merkle_root,
      verification_level: successPayload.verification_level,
    };

    await register({ label, idkitResult });
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <StepIndicator currentStep={3} />
        <div className="mt-6 rounded-xl border border-[var(--brand-mint)]/15 bg-[var(--brand-mint)]/[0.03] p-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--brand-mint)]">
            {label}.humanens.eth is live
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your verified HumanENS subname has been registered.
          </p>
          {txHash && (
            <p className="mt-2 break-all text-xs text-muted-foreground/60">Tx: {txHash}</p>
          )}
          <Link
            href="/app/manage"
            className="mt-5 inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Manage Agents
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <StepIndicator currentStep={2} />

      <div className="pt-2">
        <h1 className="text-[22px] font-bold tracking-tight">Register subname</h1>
        <p className="text-[13px] text-muted-foreground">
          Verify &amp; claim your .humanens.eth
        </p>
      </div>

      {/* Label input */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.5px] text-muted-foreground/60">
          Your label
        </p>
        <div className="flex items-center gap-2">
          <input
            placeholder="alice"
            value={label}
            onChange={(e) => setLabel(e.target.value.toLowerCase())}
            disabled={status !== "idle"}
            className="h-10 flex-1 rounded-lg border border-[var(--border-input)] bg-white/[0.05] px-3 text-[15px] outline-none focus:border-[var(--brand-blue)]/30 disabled:opacity-50"
          />
          <span className="text-xs text-muted-foreground/50">.humanens.eth</span>
        </div>
      </div>

      {/* Source name info */}
      {label && (
        <div className="rounded-xl border border-[var(--brand-blue)]/[0.08] bg-[var(--brand-blue)]/[0.04] p-4">
          <p className="mb-1 text-xs text-muted-foreground/60">Source name</p>
          <p className="text-sm">
            <span className="text-muted-foreground">{label}.eth</span>
            <span className="text-muted-foreground/30"> → </span>
            <span className="text-[var(--brand-mint)]">{label}.humanens.eth</span>
          </p>
        </div>
      )}

      {/* Status */}
      {statusMessages[status] && (
        <p className="animate-pulse text-center text-sm text-muted-foreground">
          {statusMessages[status]}
        </p>
      )}

      {/* CTA */}
      <button
        className="w-full rounded-full bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand-blue)] py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={!label || status !== "idle"}
        onClick={handleVerifyAndRegister}
      >
        {status === "idle" ? "Verify & Register (Gas Free)" : "Processing..."}
      </button>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </main>
  );
}

export default function AppPage() {
  return (
    <MiniKitGate>
      <RegisterFlow />
    </MiniKitGate>
  );
}
