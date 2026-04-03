"use client";

import { useQueryState } from "nuqs";
import { useVerifyName } from "@/hooks/use-verify-name";

export function Verifier() {
  const [name, setName] = useQueryState("name", { defaultValue: "" });
  const { verify, result, isLoading, error } = useVerifyName();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) verify(name.trim());
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          placeholder="alice.eth"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 flex-1 rounded-lg px-4 text-sm outline-none transition-all placeholder:text-muted-foreground/50"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.05)",
            color: "#fafafa",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(110,231,183,0.3)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(110,231,183,0.08)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="h-11 rounded-lg px-5 text-sm font-medium transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: "linear-gradient(135deg, #6EE7B7, #3889FF)",
            color: "#09090b",
            boxShadow: "0 2px 12px rgba(110,231,183,0.25)",
          }}
        >
          {isLoading ? "Checking..." : "Check"}
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Enter any .eth name to check if it&apos;s verified
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div
          className="rounded-lg p-3.5 animate-fade-in"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {result.name}
            </span>
            {result.isVerified ? (
              <span
                className="verified-glow rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{
                  background: "rgba(110,231,183,0.12)",
                  color: "#6EE7B7",
                  border: "1px solid rgba(110,231,183,0.2)",
                }}
              >
                &#x2713; Verified Human
              </span>
            ) : (
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Not Verified
              </span>
            )}
          </div>
          {result.humanensSubname && (
            <p className="mt-2 text-xs text-muted-foreground">
              Subname: {result.humanensSubname}
              {result.worldIdLevel && <> &middot; World ID: {result.worldIdLevel}</>}
            </p>
          )}
          {result.isVerified && (
            <p className="mt-1 text-xs" style={{ color: "rgba(110,231,183,0.7)" }}>
              Bidirectional link verified
            </p>
          )}
          {result.humanensSubname && !result.reverseRecordValid && (
            <p className="mt-1 text-xs text-yellow-500">
              Warning: reverse record not set on {result.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
