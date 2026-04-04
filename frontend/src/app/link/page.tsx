"use client";

import { ConnectButton } from "@/components/connect-button";
import { StepIndicator } from "@/components/step-indicator";
import { useEnsNames } from "@/hooks/use-ens-names";
import { useIdkitVerify } from "@/hooks/use-idkit-verify";
import { useSetTextRecord } from "@/hooks/use-set-text-record";
import { cn } from "@/lib/utils";
import { IDKitRequestWidget, orbLegacy } from "@worldcoin/idkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAccount } from "wagmi";

export default function LinkPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { names, isLoading: loadingNames } = useEnsNames();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      router.replace("/app");
    }
  }, [router]);

  useEffect(() => {
    if (names.length > 0 && !selectedName) {
      setSelectedName(names[0]);
    }
  }, [names, selectedName]);

  const { setTextRecord, isPending, isConfirming, isSuccess, hash, error } = useSetTextRecord();
  const {
    rpContext,
    isLoadingRp,
    fetchRpContext,
    nullifier,
    verifyNullifier,
    error: idkitError,
    appId,
    action,
  } = useIdkitVerify();

  const [idkitOpen, setIdkitOpen] = useState(false);

  const hasVerified = !!nullifier;

  async function handleStartVerify() {
    await fetchRpContext();
    setIdkitOpen(true);
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <StepIndicator currentStep={1} />

      <div className="pt-2 animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">Link your ENS name</h1>
        <p className="text-sm text-muted-foreground">
          Verify your World ID and set a text record on your .eth name
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

      {/* World ID verification */}
      <div
        className={cn(
          "glass-card animate-fade-in-up delay-300 rounded-xl p-4",
          !selectedName && "pointer-events-none opacity-40",
        )}
      >
        <p className="mb-2 text-xs text-muted-foreground">World ID Verification</p>
        {hasVerified ? (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "#6EE7B7" }}>
              &#x2713; Verified
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {nullifier?.slice(0, 10)}...{nullifier?.slice(-6)}
            </span>
          </div>
        ) : (
          <button
            className="w-full rounded-lg h-11 text-sm font-medium transition-all hover:scale-[1.01] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #6EE7B7, #3889FF)",
              color: "#09090b",
            }}
            disabled={!selectedName || isLoadingRp}
            onClick={handleStartVerify}
          >
            {isLoadingRp ? "Loading..." : "Verify with World ID"}
          </button>
        )}
      </div>

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
          onSuccess={async (result) => {
            await verifyNullifier(result);
          }}
          onError={(code) => console.error("IDKit error", code)}
        />
      )}

      {/* Preview / Success */}
      {isSuccess ? (
        <>
          {/* Success card */}
          <div className="glass-card animate-fade-in-up rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="animate-subtle-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "rgba(110,231,183,0.1)",
                  boxShadow: "0 0 12px rgba(110,231,183,0.3)",
                }}
              >
                <span style={{ color: "#6EE7B7" }}>&#x2713;</span>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#6EE7B7" }}>Record Set</p>
                <p className="text-xs text-muted-foreground">
                  Nullifier bound to <code style={{ color: "#6EE7B7" }}>{selectedName}</code>
                </p>
              </div>
            </div>

            {hash && (
              <a
                href={`https://etherscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs truncate transition-colors hover:underline"
                style={{ color: "rgba(56,137,255,0.7)" }}
              >
                View on Etherscan
              </a>
            )}
          </div>

          {/* Next step */}
          <div
            className="animate-fade-in-up delay-100 rounded-xl p-5 space-y-4"
            style={{
              border: "1px solid rgba(56,137,255,0.12)",
              background: "rgba(56,137,255,0.03)",
              boxShadow: "inset 0 1px 0 rgba(56,137,255,0.06)",
            }}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">Next: Claim your subname</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scan with World App to claim{" "}
                <code style={{ color: "#6EE7B7" }}>{selectedName?.replace(".eth", "")}.humanens.eth</code>
              </p>
            </div>
            {(() => {
              const labelParam = selectedName?.replace(".eth", "") ?? "";
              const registerPath = encodeURIComponent(`/app/register?label=${labelParam}`);
              const miniAppUrl = `https://worldcoin.org/mini-app?app_id=${appId}&path=${registerPath}`;
              return (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG
                      value={miniAppUrl}
                      size={160}
                      level="M"
                    />
                  </div>
                  <a
                    href={miniAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium transition-all hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, #6EE7B7, #3889FF)",
                      color: "#09090b",
                    }}
                  >
                    Open World App
                  </a>
                </div>
              );
            })()}
          </div>
        </>
      ) : (
        <>
          {/* Preview */}
          <div
            className={cn(
              "animate-fade-in-up delay-300 rounded-xl p-4",
              !hasVerified && "pointer-events-none opacity-40",
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
              <code className="text-xs break-all" style={{ color: "#6EE7B7" }}>
                {nullifier || "..."}
              </code>
            </p>
          </div>

          {/* CTA */}
          <button
            className="w-full rounded-full bg-white text-[#0a0a0a] h-12 text-[15px] font-medium shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg"
            style={{ backgroundColor: "#fafafa", color: "#0a0a0a" }}
            disabled={!hasVerified || isPending || isConfirming}
            onClick={() => selectedName && nullifier && setTextRecord(selectedName, nullifier)}
          >
            {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Set Record"}
          </button>

          {(error || idkitError) && (
            <p className="text-center text-sm text-destructive">
              {(error as Error)?.message || idkitError}
            </p>
          )}
        </>
      )}
    </main>
  );
}
