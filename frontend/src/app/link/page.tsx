"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { StepIndicator } from "@/components/step-indicator";
import { useEnsNames } from "@/hooks/use-ens-names";
import { useSetTextRecord } from "@/hooks/use-set-text-record";
import { cn } from "@/lib/utils";

export default function LinkPage() {
  const { isConnected } = useAccount();
  const { names, isLoading: loadingNames } = useEnsNames();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const { setTextRecord, isPending, isConfirming, isSuccess, hash, error } = useSetTextRecord();

  const label = selectedName?.replace(/\.eth$/, "");

  if (isSuccess) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <StepIndicator currentStep={1} />
        <div className="mt-6 rounded-xl border border-[var(--brand-mint)]/15 bg-[var(--brand-mint)]/[0.03] p-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--brand-mint)]">Record Set</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <code className="text-[var(--brand-blue)]">humanens</code>{" = "}
            <code className="text-[var(--brand-mint)]">{label}.humanens.eth</code>
          </p>
          {hash && <p className="mt-2 break-all text-xs text-muted-foreground/60">Tx: {hash}</p>}
          <div className="mt-6 space-y-1">
            <p className="font-medium">Continue in World App</p>
            <p className="text-sm text-muted-foreground">
              Open the HumanENS Mini App in World App to verify with World ID and claim your subname.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <StepIndicator currentStep={1} />

      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Link your ENS name</h1>
        <p className="text-sm text-muted-foreground">
          Set a text record on your .eth name to prove ownership
        </p>
      </div>

      {/* Wallet */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">Wallet</span>
          <ConnectButton />
        </div>
      </div>

      {/* ENS names */}
      <div
        className={cn(
          "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4",
          !isConnected && "pointer-events-none opacity-40",
        )}
      >
        <p className="mb-3 text-xs text-muted-foreground">Your ENS names</p>
        {loadingNames ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading names...</p>
        ) : names.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isConnected ? "No ENS names found for this address" : "Connect your wallet first"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {names.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedName(name)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left text-sm transition-colors",
                  selectedName === name
                    ? "border-[var(--brand-mint)]/20 bg-[var(--brand-mint)]/[0.04] text-foreground"
                    : "border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]",
                )}
              >
                {selectedName === name && (
                  <span className="mr-2 text-[var(--brand-mint)]">●</span>
                )}
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div
        className={cn(
          "rounded-xl border border-[var(--brand-mint)]/[0.08] bg-[var(--brand-mint)]/[0.03] p-4",
          !selectedName && "pointer-events-none opacity-40",
        )}
      >
        <p className="mb-2 text-xs text-muted-foreground">Will set text record</p>
        <p className="text-[15px]">
          <code className="text-[var(--brand-blue)]">humanens</code>
          <span className="text-muted-foreground/40"> = </span>
          <code className="text-[var(--brand-mint)]">{label || "..."}.humanens.eth</code>
        </p>
      </div>

      {/* CTA */}
      <button
        className="w-full rounded-full bg-foreground py-3 text-[15px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={!selectedName || isPending || isConfirming}
        onClick={() => selectedName && setTextRecord(selectedName)}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Set Record"}
      </button>

      {error && <p className="text-center text-sm text-destructive">{error.message}</p>}
    </main>
  );
}
