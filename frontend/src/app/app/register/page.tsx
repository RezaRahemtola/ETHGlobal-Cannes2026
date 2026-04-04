"use client";

import { useState } from "react";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import { MiniKitGate } from "@/components/minikit-gate";
import { StepIndicator } from "@/components/step-indicator";
import { useRegisterLink } from "@/hooks/use-register-link";
import { useIdkitVerify } from "@/hooks/use-idkit-verify";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterFlow() {
  const searchParams = useSearchParams();
  const [label, setLabel] = useState(searchParams.get("label") ?? "");
  const { register, status, error, txHash } = useRegisterLink();
  const {
    rpContext,
    isLoadingRp,
    fetchRpContext,
    error: idkitError,
    appId,
    action,
  } = useIdkitVerify();

  const [idkitOpen, setIdkitOpen] = useState(false);

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

  async function handleStartVerify() {
    await fetchRpContext();
    setIdkitOpen(true);
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <StepIndicator currentStep={3} />
        <div
          className="mt-6 rounded-xl p-6 text-center animate-fade-in-up"
          style={{
            border: "1px solid rgba(110,231,183,0.2)",
            background:
              "linear-gradient(135deg, rgba(110,231,183,0.06) 0%, rgba(56,137,255,0.04) 50%, rgba(139,92,246,0.03) 100%)",
            boxShadow:
              "0 0 40px rgba(110,231,183,0.08), 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: "rgba(110,231,183,0.12)",
              boxShadow: "0 0 24px rgba(110,231,183,0.2)",
            }}
          >
            <span className="text-xl" style={{ color: "#6EE7B7" }}>
              &#x2713;
            </span>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "#6EE7B7" }}>
            {label}.humanens.eth is live
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your verified HumanENS subname has been registered.
          </p>
          {txHash && (
            <p className="mt-2 break-all text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Tx: {txHash}
            </p>
          )}
          <Link
            href="/app/manage"
            className="mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
            style={{ backgroundColor: "#fafafa", color: "#09090b" }}
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

      <div className="pt-2 animate-fade-in-up">
        <h1 className="text-[22px] font-bold tracking-tight">Register subname</h1>
        <p className="text-[13px] text-muted-foreground">Verify &amp; claim your .humanens.eth</p>
      </div>

      {/* Label input */}
      <div className="glass-card animate-fade-in-up delay-100 rounded-xl p-4">
        <p
          className="mb-2 text-[11px] uppercase tracking-[0.5px]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Your label
        </p>
        <div className="flex items-center gap-2">
          <input
            placeholder="alice"
            value={label}
            onChange={(e) => setLabel(e.target.value.toLowerCase())}
            disabled={status !== "idle"}
            className="h-10 flex-1 rounded-lg px-4 text-[15px] outline-none transition-all disabled:opacity-50"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              color: "#fafafa",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(56,137,255,0.3)";
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(56,137,255,0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            .humanens.eth
          </span>
        </div>
      </div>

      {/* Source name info */}
      {label && (
        <div
          className="rounded-xl p-4 animate-fade-in"
          style={{
            border: "1px solid rgba(56,137,255,0.1)",
            background: "rgba(56,137,255,0.04)",
            boxShadow: "inset 0 1px 0 rgba(56,137,255,0.06)",
          }}
        >
          <p className="mb-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Source name
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">{label}.eth</span>
            <span style={{ color: "rgba(255,255,255,0.15)" }}> &rarr; </span>
            <span style={{ color: "#6EE7B7" }}>{label}.humanens.eth</span>
          </p>
        </div>
      )}

      {/* Status */}
      {statusMessages[status] && (
        <p className="animate-pulse text-center text-sm text-muted-foreground">
          {statusMessages[status]}
        </p>
      )}

      {/* IDKit widget */}
      {rpContext && (
        <IDKitRequestWidget
          open={idkitOpen}
          onOpenChange={setIdkitOpen}
          app_id={appId as `app_${string}`}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbLegacy()}
          onSuccess={(result) => {
            if (label) register({ label, idkitResult: result });
          }}
          onError={(code) => console.error("IDKit error", code)}
        />
      )}

      {/* CTA */}
      <button
        className="btn-glow w-full rounded-full h-12 text-[15px] font-medium text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
        style={{
          background: "linear-gradient(135deg, #6EE7B7 0%, #3889FF 50%, #8B5CF6 100%)",
        }}
        disabled={!label || status !== "idle" || isLoadingRp}
        onClick={handleStartVerify}
      >
        {status === "idle" ? (isLoadingRp ? "Loading..." : "Verify & Register") : "Processing..."}
      </button>

      {(error || idkitError) && (
        <p className="text-center text-sm text-destructive">{error || idkitError}</p>
      )}
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
