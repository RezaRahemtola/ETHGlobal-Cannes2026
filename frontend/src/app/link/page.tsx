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
        <div
          className="mt-6 rounded-xl p-6 text-center animate-fade-in-up"
          style={{
            border: "1px solid rgba(110,231,183,0.15)",
            background: "rgba(110,231,183,0.04)",
            boxShadow: "0 0 32px rgba(110,231,183,0.06), inset 0 1px 0 rgba(110,231,183,0.08)",
          }}
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(110,231,183,0.1)" }}>
            <span className="text-lg">&#x2713;</span>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "#6EE7B7" }}>Record Set</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <code style={{ color: "#3889FF" }}>humanens</code>{" = "}
            <code style={{ color: "#6EE7B7" }}>{label}.humanens.eth</code>
          </p>
          {hash && <p className="mt-2 break-all text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Tx: {hash}</p>}
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

      <div className="pt-2 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">Link your ENS name</h1>
        <p className="text-sm text-muted-foreground">
          Set a text record on your .eth name to prove ownership
        </p>
      </div>

      {/* Wallet */}
      <div className="glass-card animate-fade-in-up delay-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">Wallet</span>
          <ConnectButton />
        </div>
      </div>

      {/* ENS names */}
      <div
        className={cn(
          "glass-card animate-fade-in-up delay-200 rounded-xl p-4",
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
                  "w-full rounded-lg border p-3 text-left text-sm transition-all duration-200",
                  selectedName === name
                    ? "scale-[1.01] text-foreground"
                    : "hover:scale-[1.005]",
                )}
                style={
                  selectedName === name
                    ? {
                        borderColor: "rgba(110,231,183,0.25)",
                        background: "rgba(110,231,183,0.06)",
                        boxShadow: "0 0 16px rgba(110,231,183,0.08), inset 0 1px 0 rgba(110,231,183,0.06)",
                      }
                    : {
                        borderColor: "rgba(255,255,255,0.06)",
                        background: "transparent",
                      }
                }
              >
                {selectedName === name && (
                  <span style={{ color: "#6EE7B7" }} className="mr-2">&#x25CF;</span>
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
          "animate-fade-in-up delay-300 rounded-xl p-4",
          !selectedName && "pointer-events-none opacity-40",
        )}
        style={{
          border: "1px solid rgba(110,231,183,0.1)",
          background: "rgba(110,231,183,0.03)",
          boxShadow: "inset 0 1px 0 rgba(110,231,183,0.05)",
        }}
      >
        <p className="mb-2 text-xs text-muted-foreground">Will set text record</p>
        <p className="text-[15px]">
          <code style={{ color: "#3889FF" }}>humanens</code>
          <span style={{ color: "rgba(255,255,255,0.2)" }}> = </span>
          <code style={{ color: "#6EE7B7" }}>{label || "..."}.humanens.eth</code>
        </p>
      </div>

      {/* CTA */}
      <button
        className="w-full rounded-full py-3 text-[15px] font-medium shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
        style={{ backgroundColor: "#fafafa", color: "#09090b" }}
        disabled={!selectedName || isPending || isConfirming}
        onClick={() => selectedName && setTextRecord(selectedName)}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Set Record"}
      </button>

      {error && <p className="text-center text-sm text-destructive">{error.message}</p>}
    </main>
  );
}
