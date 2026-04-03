"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { MiniKit } from "@worldcoin/minikit-js";
import { ConnectButton } from "@/components/connect-button";
import { StepIndicator } from "@/components/step-indicator";
import { useEnsNames } from "@/hooks/use-ens-names";
import { useSetTextRecord } from "@/hooks/use-set-text-record";
import { cn } from "@/lib/utils";

export default function LinkPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      router.replace("/app");
    }
  }, [router]);
  const { names, isLoading: loadingNames } = useEnsNames();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Auto-select first name when names load
  useEffect(() => {
    if (names.length > 0 && !selectedName) {
      setSelectedName(names[0]);
    }
  }, [names, selectedName]);
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
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(110,231,183,0.1)" }}
          >
            <span className="text-lg">&#x2713;</span>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "#6EE7B7" }}>
            Record Set
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <code style={{ color: "#3889FF" }}>humanens</code>
            {" = "}
            <code style={{ color: "#6EE7B7" }}>{label}.humanens.eth</code>
          </p>
          {hash && (
            <p className="mt-2 break-all text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Tx: {hash}
            </p>
          )}
          <div className="mt-6 space-y-1">
            <p className="font-medium">Continue in World App</p>
            <p className="text-sm text-muted-foreground">
              Open the HumanENS Mini App in World App to verify with World ID and claim your
              subname.
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
        <p className="mb-2 text-xs text-muted-foreground">Your ENS name</p>
        {loadingNames ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading names...</p>
        ) : names.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isConnected ? "No ENS names found for this address" : "Connect your wallet first"}
          </p>
        ) : (
          <select
            value={selectedName ?? ""}
            onChange={(e) => setSelectedName(e.target.value || null)}
            className="h-11 w-full appearance-none rounded-lg bg-transparent px-4 text-sm text-foreground outline-none cursor-pointer"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            {names.length === 0 && <option value="">Select a name...</option>}
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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
        className="w-full rounded-full bg-white text-[#0a0a0a] h-12 text-[15px] font-medium shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg"
        style={{ backgroundColor: "#fafafa", color: "#0a0a0a" }}
        disabled={!selectedName || isPending || isConfirming}
        onClick={() => selectedName && setTextRecord(selectedName)}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Set Record"}
      </button>

      {error && <p className="text-center text-sm text-destructive">{error.message}</p>}
    </main>
  );
}
