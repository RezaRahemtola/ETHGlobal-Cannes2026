"use client";

import { useState } from "react";
import {
  MiniKit,
  VerificationLevel,
  type MiniAppVerifyActionSuccessPayload,
  type MiniAppSendTransactionSuccessPayload,
} from "@worldcoin/minikit-js";
import { MiniKitGate } from "@/components/minikit-gate";
import { useAgents } from "@/hooks/use-agents";
import { useCreateAgent } from "@/hooks/use-create-agent";
import { cn } from "@/lib/utils";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL, WORLD_ACTION_ID } from "@/lib/constants";

// ---- Revoke hook (inline, similar to create) ----
type RevokeStatus =
  | "idle"
  | "verifying"
  | "attesting"
  | "sending"
  | "confirming"
  | "success"
  | "error";

function useRevokeAgent() {
  const [status, setStatus] = useState<RevokeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function revokeAgent(args: { parentLabel: string; agentLabel: string }) {
    setStatus("verifying");
    setError(null);

    try {
      const { finalPayload: verifyPayload } = await MiniKit.commandsAsync.verify({
        action: WORLD_ACTION_ID,
        verification_level: VerificationLevel.Orb,
      });

      if (verifyPayload.status !== "success") throw new Error("World ID verification failed");

      const successVerify = verifyPayload as MiniAppVerifyActionSuccessPayload;
      const idkitResult = {
        nullifier_hash: successVerify.nullifier_hash,
        proof: successVerify.proof,
        merkle_root: successVerify.merkle_root,
        verification_level: successVerify.verification_level,
      };

      setStatus("attesting");

      const attResponse = await fetch(`${BACKEND_URL}/api/attest-revoke-agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentLabel: args.parentLabel,
          agentLabel: args.agentLabel,
          idkitResult,
        }),
      });

      if (!attResponse.ok) throw new Error("Backend attestation failed");

      const { nullifierHash, timestamp, signature } = (await attResponse.json()) as {
        nullifierHash: `0x${string}`;
        timestamp: string;
        signature: `0x${string}`;
      };

      setStatus("sending");

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: HUMANENS_LINKER_ADDRESS,
            abi: humanENSLinkerABI,
            functionName: "revokeAgentSubname",
            args: [args.parentLabel, args.agentLabel, nullifierHash, BigInt(timestamp), signature],
          },
        ],
      });

      if (finalPayload.status !== "success") throw new Error("Transaction failed");

      const successPayload = finalPayload as MiniAppSendTransactionSuccessPayload;

      setStatus("confirming");
      let attempts = 0;
      while (attempts < 30) {
        const statusRes = await fetch(
          `https://developer.world.org/api/v2/minikit/transaction/${successPayload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_WORLD_APP_ID}`,
        );
        const statusData = await statusRes.json();
        if (statusData.transactionStatus === "confirmed") {
          setStatus("success");
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke agent");
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
  }

  return { revokeAgent, status, error, reset };
}

// ---- Agent card ----
function AgentCard({
  agent,
  onRevoked,
}: {
  agent: { parentLabel: string; agentLabel: string; agentAddress: string; fullName: string };
  onRevoked: () => void;
}) {
  const { revokeAgent, status, error, reset } = useRevokeAgent();

  const isBusy = status !== "idle" && status !== "success" && status !== "error";

  const statusLabel: Record<string, string> = {
    verifying: "Verifying with World ID...",
    attesting: "Getting attestation...",
    sending: "Confirm in World App...",
    confirming: "Confirming...",
  };

  async function handleRevoke() {
    await revokeAgent({ parentLabel: agent.parentLabel, agentLabel: agent.agentLabel });
    if (status === "success") onRevoked();
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 space-y-1">
        <p className="text-sm text-muted-foreground line-through">{agent.fullName}</p>
        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
          Revoked
        </span>
      </div>
    );
  }

  return (
    <div className="glass-card glass-card-hover rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            <span>{agent.agentLabel}</span>
            <span className="text-muted-foreground font-normal">
              .{agent.parentLabel}.humanens.eth
            </span>
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {agent.agentAddress}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{
            background: "rgba(110,231,183,0.1)",
            color: "#6EE7B7",
            border: "1px solid rgba(110,231,183,0.2)",
            boxShadow: "0 0 8px rgba(110,231,183,0.1)",
          }}
        >
          Active
        </span>
      </div>

      {isBusy && (
        <p className="text-xs text-muted-foreground animate-pulse">{statusLabel[status]}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        {error ? (
          <button
            onClick={reset}
            className="flex-1 h-8 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-all hover:scale-[1.01]"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Retry
          </button>
        ) : (
          <button
            onClick={handleRevoke}
            disabled={isBusy}
            className={cn(
              "flex-1 h-8 rounded-full text-xs font-medium transition-all",
              "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-[1.01]",
              isBusy && "opacity-50 cursor-not-allowed hover:scale-100",
            )}
          >
            {isBusy ? "Processing..." : "Revoke"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Manage flow ----
function ManageFlow() {
  const [parentLabel, setParentLabel] = useState("");
  const [submittedLabel, setSubmittedLabel] = useState("");

  const [agentLabel, setAgentLabel] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { agents, isLoading } = useAgents(submittedLabel);
  const {
    createAgent,
    status: createStatus,
    error: createError,
    reset: createReset,
  } = useCreateAgent();

  const isCreating =
    createStatus !== "idle" && createStatus !== "success" && createStatus !== "error";

  const createStatusLabel: Record<string, string> = {
    attesting: "Getting attestation...",
    sending: "Confirm in World App...",
    confirming: "Confirming transaction...",
  };

  async function handleCreate() {
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

    await createAgent({
      parentLabel: submittedLabel,
      agentLabel,
      agentAddress: agentAddress as `0x${string}`,
      idkitResult,
    });

    if (createStatus !== "error") {
      setAgentLabel("");
      setAgentAddress("");
      setRefreshKey((k) => k + 1);
    }
  }

  function handleLookup() {
    setSubmittedLabel(parentLabel.trim().toLowerCase());
    setRefreshKey((k) => k + 1);
  }

  const isAddressValid = /^0x[0-9a-fA-F]{40}$/.test(agentAddress);
  const canCreate = submittedLabel && agentLabel.trim() && isAddressValid && !isCreating;

  return (
    <main className="mx-auto max-w-lg px-4 py-10 space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Manage Agents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create and revoke agent subnames for your HumanENS identity
        </p>
      </div>

      {/* Parent label lookup */}
      <div className="glass-card animate-fade-in-up delay-100 rounded-xl px-4 py-4 space-y-3">
        <label
          className="block text-[11px] uppercase tracking-[0.5px]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Your HumanENS label
        </label>
        <div className="flex items-center gap-2">
          <input
            placeholder="alice"
            value={parentLabel}
            onChange={(e) => setParentLabel(e.target.value.toLowerCase())}
            className="flex-1 h-10 rounded-lg px-4 text-sm text-white outline-none transition-all"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
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
          <span className="text-sm text-muted-foreground shrink-0">.humanens.eth</span>
        </div>
        <button
          onClick={handleLookup}
          disabled={!parentLabel.trim()}
          className={cn(
            "w-full h-10 rounded-full text-sm font-medium text-muted-foreground transition-all",
            parentLabel.trim()
              ? "hover:text-foreground hover:scale-[1.005]"
              : "opacity-40 cursor-not-allowed",
          )}
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Load Agents
        </button>
      </div>

      {/* Agent list */}
      {submittedLabel && (
        <>
          <div className="animate-fade-in">
            <h2 className="text-base font-semibold text-white mb-3">
              Active Agents
              {!isLoading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({agents.length})
                </span>
              )}
            </h2>

            {isLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading agents...</p>
            ) : agents.length === 0 ? (
              <div className="glass-card rounded-xl px-4 py-4">
                <p className="text-sm text-muted-foreground text-center">
                  No active agents for {submittedLabel}.humanens.eth
                </p>
              </div>
            ) : (
              <div className="space-y-3" key={refreshKey}>
                {agents.map((agent) => (
                  <AgentCard
                    key={`${agent.parentLabel}:${agent.agentLabel}`}
                    agent={agent}
                    onRevoked={() => setRefreshKey((k) => k + 1)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* Create new agent */}
          <div className="animate-fade-in">
            <h2 className="text-base font-semibold text-white mb-3">Add New Agent</h2>

            <div className="glass-card rounded-xl px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  className="block text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Agent label
                </label>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="my-agent"
                    value={agentLabel}
                    onChange={(e) => setAgentLabel(e.target.value.toLowerCase())}
                    disabled={isCreating}
                    className="flex-1 h-10 rounded-lg px-4 text-sm text-white outline-none transition-all disabled:opacity-50"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
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
                  <span className="text-xs text-muted-foreground shrink-0">
                    .{submittedLabel}.humanens.eth
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Agent wallet address
                </label>
                <input
                  placeholder="0x..."
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value)}
                  disabled={isCreating}
                  className="w-full h-10 rounded-lg px-3 font-mono text-sm text-white outline-none transition-all disabled:opacity-50"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.05)",
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
                {agentAddress && !isAddressValid && (
                  <p className="text-xs text-destructive mt-1">Invalid address</p>
                )}
              </div>

              {isCreating && (
                <p className="text-sm text-muted-foreground animate-pulse text-center">
                  {createStatusLabel[createStatus] ?? "Processing..."}
                </p>
              )}

              {createStatus === "success" && (
                <p className="text-sm text-center" style={{ color: "#6EE7B7" }}>
                  Agent created successfully!
                </p>
              )}

              {createError && <p className="text-sm text-destructive text-center">{createError}</p>}

              <div className="flex gap-2">
                {createError && (
                  <button
                    onClick={createReset}
                    className="flex-1 h-10 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-all hover:scale-[1.005]"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  className={cn(
                    "btn-glow flex-1 h-10 rounded-full text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]",
                    !canCreate && "opacity-40 cursor-not-allowed hover:scale-100 hover:shadow-lg",
                  )}
                  style={{
                    background: "linear-gradient(135deg, #6EE7B7 0%, #3889FF 50%, #8B5CF6 100%)",
                  }}
                >
                  {isCreating ? "Processing..." : "Create Agent (Gas Free)"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default function ManagePage() {
  return (
    <MiniKitGate>
      <ManageFlow />
    </MiniKitGate>
  );
}
