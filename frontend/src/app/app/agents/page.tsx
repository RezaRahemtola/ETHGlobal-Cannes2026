"use client";

import { useState } from "react";
import { MiniKit, type MiniAppSendTransactionSuccessPayload } from "@worldcoin/minikit-js";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import { MiniKitGate } from "@/components/minikit-gate";
import { useAgents } from "@/hooks/use-agents";
import { useCreateAgent } from "@/hooks/use-create-agent";
import { useIdkitVerify } from "@/hooks/use-idkit-verify";
import { cn } from "@/lib/utils";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL } from "@/lib/constants";
import { ERC8004_CHAINS, buildENSIP25Key } from "@/lib/erc7930";
import { useAgentBookRegister } from "@/hooks/use-agentbook";
import { type Agent } from "@/hooks/use-agents";

// ---- Revoke hook (inline, similar to create) ----
type RevokeStatus = "idle" | "attesting" | "sending" | "confirming" | "success" | "error";

function useRevokeAgent() {
  const [status, setStatus] = useState<RevokeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function revokeAgent(args: {
    parentLabel: string;
    agentLabel: string;
    idkitResult: unknown;
  }) {
    setStatus("attesting");
    setError(null);

    try {
      const attResponse = await fetch(`${BACKEND_URL}/api/verify-and-sign-revoke-agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentLabel: args.parentLabel,
          agentLabel: args.agentLabel,
          idkitResult: args.idkitResult,
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
  onRefresh,
}: {
  agent: Agent;
  onRevoked: () => void;
  onRefresh: () => void;
}) {
  const { revokeAgent, status, error, reset } = useRevokeAgent();
  const { rpContext, isLoadingRp, fetchRpContext, appId, action } = useIdkitVerify();
  const {
    registerAgent: registerAgentBook,
    status: abStatus,
    error: abError,
    reset: abReset,
  } = useAgentBookRegister();

  const isAbBusy = abStatus !== "idle" && abStatus !== "success" && abStatus !== "error";

  async function handleAgentBookRegister() {
    await registerAgentBook(agent.agentAddress as `0x${string}`);
    onRefresh();
  }
  const [idkitOpen, setIdkitOpen] = useState(false);

  const isBusy = status !== "idle" && status !== "success" && status !== "error";

  const statusLabel: Record<string, string> = {
    attesting: "Getting attestation...",
    sending: "Confirm in World App...",
    confirming: "Confirming...",
  };

  async function handleRevoke() {
    await fetchRpContext();
    setIdkitOpen(true);
  }

  function handleIdkitSuccess(result: unknown) {
    revokeAgent({
      parentLabel: agent.parentLabel,
      agentLabel: agent.agentLabel,
      idkitResult: result,
    }).then(() => {
      onRevoked();
    });
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

      {/* Status badges */}
      <div className="flex gap-1.5 flex-wrap">
        {agent.agentBookRegistered ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(56,137,255,0.1)", color: "#3889FF", border: "1px solid rgba(56,137,255,0.2)" }}>
            AgentBook
          </span>
        ) : (
          <button
            onClick={handleAgentBookRegister}
            disabled={isAbBusy}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(255,255,255,0.15)" }}>
            {isAbBusy ? "Registering..." : "+ AgentBook"}
          </button>
        )}
      </div>

      {abStatus === "success" && (
        <p className="text-xs" style={{ color: "#6EE7B7" }}>Registered in AgentBook!</p>
      )}
      {abError && <p className="text-xs text-destructive">{abError}</p>}

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
            disabled={isBusy || isLoadingRp}
            className={cn(
              "flex-1 h-8 rounded-full text-xs font-medium transition-all",
              "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-[1.01]",
              (isBusy || isLoadingRp) && "opacity-50 cursor-not-allowed hover:scale-100",
            )}
          >
            {isLoadingRp ? "Loading..." : isBusy ? "Processing..." : "Revoke"}
          </button>
        )}
      </div>

      {rpContext && (
        <IDKitRequestWidget
          open={idkitOpen}
          onOpenChange={setIdkitOpen}
          app_id={appId as `app_${string}`}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={deviceLegacy()}
          onSuccess={handleIdkitSuccess}
          onError={(code) => console.error("IDKit error", code)}
        />
      )}
    </div>
  );
}

// ---- Manage flow ----
function ManageFlow() {
  const [parentLabel, setParentLabel] = useState("");
  const [submittedLabel, setSubmittedLabel] = useState("");

  const [agentLabel, setAgentLabel] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [erc8004Chain, setErc8004Chain] = useState<number | null>(null);
  const [erc8004AgentId, setErc8004AgentId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { agents, isLoading } = useAgents(submittedLabel);
  const {
    createAgent,
    status: createStatus,
    error: createError,
    reset: createReset,
  } = useCreateAgent();
  const {
    rpContext: createRpContext,
    isLoadingRp: isLoadingCreateRp,
    fetchRpContext: fetchCreateRpContext,
    appId,
    action,
  } = useIdkitVerify();
  const [createIdkitOpen, setCreateIdkitOpen] = useState(false);

  const isCreating =
    createStatus !== "idle" && createStatus !== "success" && createStatus !== "error";

  const createStatusLabel: Record<string, string> = {
    attesting: "Getting attestation...",
    sending: "Confirm in World App...",
    confirming: "Confirming transaction...",
  };

  async function handleCreate() {
    await fetchCreateRpContext();
    setCreateIdkitOpen(true);
  }

  function handleCreateIdkitSuccess(result: unknown) {
    if (submittedLabel && agentLabel && agentAddress) {
      const ensip25Key =
        erc8004Chain && erc8004AgentId
          ? buildENSIP25Key(erc8004Chain, erc8004AgentId)
          : undefined;

      createAgent({
        parentLabel: submittedLabel,
        agentLabel,
        agentAddress: agentAddress as `0x${string}`,
        idkitResult: result,
        ensip25Key,
      }).then(() => {
        setAgentLabel("");
        setAgentAddress("");
        setErc8004Chain(null);
        setErc8004AgentId("");
        setRefreshKey((k) => k + 1);
      });
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
                    onRefresh={() => setRefreshKey((k) => k + 1)}
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

              <div className="space-y-1.5">
                <label
                  className="block text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  ERC-8004 Registration (optional)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={erc8004Chain ?? ""}
                    onChange={(e) =>
                      setErc8004Chain(e.target.value ? Number(e.target.value) : null)
                    }
                    disabled={isCreating}
                    className="flex-1 h-10 rounded-lg px-3 text-sm text-white outline-none transition-all disabled:opacity-50"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    <option value="">No ERC-8004</option>
                    {ERC8004_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Agent ID"
                    value={erc8004AgentId}
                    onChange={(e) => setErc8004AgentId(e.target.value)}
                    disabled={isCreating || !erc8004Chain}
                    className="w-24 h-10 rounded-lg px-3 text-sm text-white outline-none transition-all disabled:opacity-50"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  />
                </div>
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
                  disabled={!canCreate || isLoadingCreateRp}
                  className={cn(
                    "btn-glow flex-1 h-10 rounded-full text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]",
                    (!canCreate || isLoadingCreateRp) &&
                      "opacity-40 cursor-not-allowed hover:scale-100 hover:shadow-lg",
                  )}
                  style={{
                    background: "linear-gradient(135deg, #6EE7B7 0%, #3889FF 50%, #8B5CF6 100%)",
                  }}
                >
                  {isLoadingCreateRp ? "Loading..." : isCreating ? "Processing..." : "Create Agent"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {createRpContext && (
        <IDKitRequestWidget
          open={createIdkitOpen}
          onOpenChange={setCreateIdkitOpen}
          app_id={appId as `app_${string}`}
          action={action}
          rp_context={createRpContext}
          allow_legacy_proofs={true}
          preset={deviceLegacy()}
          onSuccess={handleCreateIdkitSuccess}
          onError={(code) => console.error("IDKit error", code)}
        />
      )}
    </main>
  );
}

export default function ManagePage() {
  return (
    <MiniKitGate description="Scan this QR code with World App to manage your agent subnames.">
      <ManageFlow />
    </MiniKitGate>
  );
}
