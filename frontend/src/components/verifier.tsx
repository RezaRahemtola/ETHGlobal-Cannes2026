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
          className="h-10 flex-1 rounded-lg border border-[var(--border-input)] bg-white/[0.05] px-3 text-sm placeholder:text-muted-foreground/50 outline-none focus:border-[var(--brand-mint)]/30"
        />
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="h-10 rounded-lg border border-[var(--brand-mint)]/15 bg-[var(--brand-mint)]/10 px-5 text-sm font-medium text-[var(--brand-mint)] transition-colors hover:bg-[var(--brand-mint)]/15 disabled:opacity-50"
        >
          {isLoading ? "Checking..." : "Check"}
        </button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-foreground/70">{result.name}</span>
            {result.isVerified ? (
              <span className="rounded-full bg-[var(--brand-mint)]/10 px-3 py-1 text-[11px] font-medium text-[var(--brand-mint)]">
                Verified Human
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Not Verified
              </span>
            )}
          </div>
          {result.humanensSubname && (
            <p className="mt-2 text-xs text-muted-foreground">
              Subname: {result.humanensSubname}
              {result.worldIdLevel && <> · World ID: {result.worldIdLevel}</>}
            </p>
          )}
          {result.isVerified && (
            <p className="mt-1 text-xs text-[var(--brand-mint)]/70">
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
