"use client";

import { useState, useEffect } from "react";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import { MiniKitGate } from "@/components/minikit-gate";
import { StepIndicator } from "@/components/step-indicator";
import { useRegisterLink } from "@/hooks/use-register-link";
import { useRevokeLink } from "@/hooks/use-revoke-link";
import { useIdkitVerify } from "@/hooks/use-idkit-verify";
import { useMyLabels } from "@/hooks/use-my-labels";
import { getEnsTextRecord } from "@/lib/ens";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterFlow() {
  const searchParams = useSearchParams();
  const [label, setLabel] = useState(searchParams.get("label") ?? "");
  const { register, status, error, txHash } = useRegisterLink();
  const {
    revokeLink,
    status: revokeStatus,
    error: revokeError,
    reset: revokeReset,
  } = useRevokeLink();
  const { labels, isLoading: isLoadingLabels, saveNullifier, needsVerify } = useMyLabels();
  const [recordCheck, setRecordCheck] = useState<"idle" | "loading" | "valid" | "missing">("idle");
  const [recordValue, setRecordValue] = useState<string | null>(null);
  const [nullifierError, setNullifierError] = useState<string | null>(null);
  const {
    rpContext,
    isLoadingRp,
    fetchRpContext,
    verifyNullifier,
    error: idkitError,
    appId,
    action,
  } = useIdkitVerify();

  const [idkitOpen, setIdkitOpen] = useState(false);
  const [identifyIdkitOpen, setIdentifyIdkitOpen] = useState(false);
  const [revokeIdkitOpen, setRevokeIdkitOpen] = useState(false);
  const [revokeLabel, setRevokeLabel] = useState<string | null>(null);

  // Check if {label}.eth has a humanens text record
  useEffect(() => {
    if (!label.trim()) {
      setRecordCheck("idle");
      return;
    }
    setRecordCheck("loading");
    const name = `${label.trim()}.eth`;
    getEnsTextRecord(name, "humanens")
      .then((val) => {
        setRecordValue(val ?? null);
        setRecordCheck(val ? "valid" : "missing");
      })
      .catch(() => {
        setRecordValue(null);
        setRecordCheck("missing");
      });
  }, [label]);

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

  async function handleIdentify() {
    await fetchRpContext();
    setIdentifyIdkitOpen(true);
  }

  async function handleIdentifySuccess(result: unknown) {
    try {
      const hash = await verifyNullifier(result);
      saveNullifier(hash);
    } catch (e) {
      console.error("Failed to verify identity:", e);
    }
  }

  async function handleStartRevoke(l: string) {
    setRevokeLabel(l);
    await fetchRpContext();
    setRevokeIdkitOpen(true);
  }

  function handleRevokeIdkitSuccess(result: unknown) {
    if (revokeLabel) {
      revokeLink({ label: revokeLabel, idkitResult: result });
    }
  }

  if (revokeStatus === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <StepIndicator currentStep={2} />
        <div
          className="mt-6 rounded-xl p-6 text-center animate-fade-in-up"
          style={{
            border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.04)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "rgba(239,68,68,0.12)" }}
          >
            <span className="text-xl text-destructive">&#x2713;</span>
          </div>
          <h2 className="text-lg font-semibold text-destructive">
            {revokeLabel}.humanens.eth unlinked
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your HumanENS subname has been removed. You can register a new one.
          </p>
          <button
            onClick={() => {
              revokeReset();
              setRevokeLabel(null);
            }}
            className="mt-5 inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
            style={{ backgroundColor: "#fafafa", color: "#09090b" }}
          >
            Register New Name
          </button>
        </div>
      </main>
    );
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
            <p className="mt-2">
              <a
                href={`https://worldscan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors hover:underline"
                style={{ color: "rgba(56,137,255,0.7)" }}
              >
                View on Worldscan
              </a>
            </p>
          )}
          <Link
            href="/app/agents"
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

      {/* Existing domain detection */}
      {needsVerify ? (
        <div className="glass-card animate-fade-in-up delay-100 rounded-xl px-4 py-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Verify your World ID to check if you already have a HumanENS name
          </p>
          <button
            onClick={handleIdentify}
            disabled={isLoadingRp}
            className="w-full h-10 rounded-full text-sm font-medium text-white transition-all hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            {isLoadingRp ? "Loading..." : "Check Existing Names"}
          </button>
        </div>
      ) : isLoadingLabels ? (
        <p className="text-sm text-muted-foreground animate-pulse text-center">
          Checking existing names...
        </p>
      ) : labels.length > 0 ? (
        <div
          className="rounded-xl p-4 animate-fade-in-up delay-100 space-y-3"
          style={{
            border: "1px solid rgba(251,191,36,0.2)",
            background: "rgba(251,191,36,0.04)",
            boxShadow: "inset 0 1px 0 rgba(251,191,36,0.06)",
          }}
        >
          <p
            className="text-[11px] uppercase tracking-[0.5px]"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Existing names
          </p>
          {labels.map((l) => (
            <div key={l} className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">
                {l}
                <span className="text-muted-foreground font-normal">.humanens.eth</span>
              </p>
              <button
                onClick={() => handleStartRevoke(l)}
                disabled={(revokeStatus !== "idle" && revokeStatus !== "error") || isLoadingRp}
                className="shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-all hover:scale-[1.01] border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {revokeLabel === l && revokeStatus === "attesting"
                  ? "Attesting..."
                  : revokeLabel === l && revokeStatus === "sending"
                    ? "Confirm in App..."
                    : "Unlink"}
              </button>
            </div>
          ))}
          {revokeError && <p className="text-xs text-destructive">{revokeError}</p>}
          <p className="text-xs text-muted-foreground">
            Unlink a name to free your World ID for a new registration.
          </p>
        </div>
      ) : null}

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

      {/* Source name info + record check */}
      {label && (
        <div
          className="rounded-xl p-4 animate-fade-in"
          style={{
            border: `1px solid ${recordCheck === "missing" ? "rgba(239,68,68,0.2)" : "rgba(56,137,255,0.1)"}`,
            background:
              recordCheck === "missing" ? "rgba(239,68,68,0.04)" : "rgba(56,137,255,0.04)",
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
          {recordCheck === "loading" && (
            <p className="mt-2 text-xs text-muted-foreground animate-pulse">
              Checking text record...
            </p>
          )}
          {recordCheck === "missing" && (
            <p className="mt-2 text-xs text-destructive">
              No <code>humanens</code> text record found on {label}.eth. Set it first on the setup
              page.
            </p>
          )}
          {recordCheck === "valid" && (
            <p className="mt-2 text-xs" style={{ color: "#6EE7B7" }}>
              &#x2713; Text record found
            </p>
          )}
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
          preset={deviceLegacy()}
          onSuccess={(result) => {
            if (!label) return;
            // Check nullifier matches the text record before proceeding
            const res = result as {
              responses?: { nullifier?: string; identifier?: string }[];
            };
            const nullifier = res.responses?.[0]?.nullifier;
            if (recordValue && nullifier && recordValue !== nullifier) {
              setNullifierError(
                "This ENS name's text record doesn't match your World ID. Did you set the record with a different World ID?",
              );
              setIdkitOpen(false);
              return;
            }
            setNullifierError(null);
            const level = res.responses?.[0]?.identifier ?? "orb";
            register({ label, idkitResult: result, level });
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
        disabled={
          !label ||
          recordCheck !== "valid" ||
          (status !== "idle" && status !== "error") ||
          isLoadingRp
        }
        onClick={handleStartVerify}
      >
        {status === "idle" || status === "error"
          ? isLoadingRp
            ? "Loading..."
            : "Verify & Register"
          : "Processing..."}
      </button>

      {(error || idkitError || nullifierError) && (
        <p className="text-center text-sm text-destructive">
          {nullifierError || error || idkitError}
        </p>
      )}

      {rpContext && (
        <>
          <IDKitRequestWidget
            open={identifyIdkitOpen}
            onOpenChange={setIdentifyIdkitOpen}
            app_id={appId as `app_${string}`}
            action={action}
            rp_context={rpContext}
            allow_legacy_proofs={true}
            preset={deviceLegacy()}
            onSuccess={handleIdentifySuccess}
            onError={(code) => console.error("IDKit identify error", code)}
          />
          <IDKitRequestWidget
            open={revokeIdkitOpen}
            onOpenChange={setRevokeIdkitOpen}
            app_id={appId as `app_${string}`}
            action={action}
            rp_context={rpContext}
            allow_legacy_proofs={true}
            preset={deviceLegacy()}
            onSuccess={handleRevokeIdkitSuccess}
            onError={(code) => console.error("IDKit revoke error", code)}
          />
        </>
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
