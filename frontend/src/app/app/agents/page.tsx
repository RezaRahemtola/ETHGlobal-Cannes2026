"use client";

import { useState, useEffect, useRef } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import { MiniKitGate } from "@/components/minikit-gate";
import { useAgents } from "@/hooks/use-agents";
import { useCreateAgent } from "@/hooks/use-create-agent";
import { useIdkitVerify } from "@/hooks/use-idkit-verify";
import { cn } from "@/lib/utils";
import { humanENSLinkerABI } from "@/lib/contracts";
import { HUMANENS_LINKER_ADDRESS, BACKEND_URL } from "@/lib/constants";
import { ERC8004_CHAINS, buildENSIP25Key } from "@/lib/erc7930";
import { type Agent } from "@/hooks/use-agents";
import { useMyLabels } from "@/hooks/use-my-labels";

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

      if (!attResponse.ok) {
        const body = await attResponse.json().catch(() => ({}));
        console.error("[revoke] Backend error:", body);
        throw new Error(body.error || "Backend attestation failed");
      }

      const { nullifierHash, timestamp, signature } = (await attResponse.json()) as {
        nullifierHash: `0x${string}`;
        timestamp: string;
        signature: `0x${string}`;
      };
      console.log("[revoke] Got attestation:", {
        nullifierHash: nullifierHash.slice(0, 10),
        timestamp,
      });

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
      console.log("[revoke] MiniKit response:", JSON.stringify(finalPayload));

      if (finalPayload.status !== "success") throw new Error("Transaction failed");

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
function AgentCard({ agent, onRevoked }: { agent: Agent; onRevoked: () => void }) {
  const { revokeAgent, status, error, reset } = useRevokeAgent();
  const { rpContext, isLoadingRp, fetchRpContext, appId, action } = useIdkitVerify();
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [showAbInfo, setShowAbInfo] = useState(false);

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
            {agent.agentAddress.slice(0, 6)}...{agent.agentAddress.slice(-4)}
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
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(56,137,255,0.1)",
              color: "#3889FF",
              border: "1px solid rgba(56,137,255,0.2)",
            }}
          >
            AgentBook
          </span>
        ) : (
          <button
            onClick={() => setShowAbInfo((v) => !v)}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-all hover:scale-105"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.4)",
              border: "1px dashed rgba(255,255,255,0.15)",
            }}
          >
            + AgentBook
          </button>
        )}
      </div>

      {showAbInfo && !agent.agentBookRegistered && (
        <div
          className="rounded-lg px-3 py-2 space-y-1.5"
          style={{ background: "rgba(56,137,255,0.05)", border: "1px solid rgba(56,137,255,0.15)" }}
        >
          <p className="text-[11px] text-muted-foreground">Register via CLI:</p>
          <code
            className="block text-[11px] font-mono break-all px-2 py-1.5 rounded"
            style={{ background: "rgba(0,0,0,0.3)", color: "#3889FF" }}
          >
            npx @worldcoin/agentkit-cli register {agent.agentAddress}
          </code>
          <a
            href="https://www.agentbook.world/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[11px] font-medium transition-all hover:underline"
            style={{ color: "#3889FF" }}
          >
            Learn more on agentbook.world &rarr;
          </a>
        </div>
      )}

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

// ---- Pending agent card (shown during creation) ----
function PendingAgentCard({
  label,
  parentLabel,
  address,
  status,
  error,
  onRetry,
}: {
  label: string;
  parentLabel: string;
  address: string;
  status: string;
  error: string | null;
  onRetry: () => void;
}) {
  const statusLabel: Record<string, string> = {
    attesting: "Getting attestation...",
    sending: "Confirm in World App...",
  };

  return (
    <div
      className="glass-card rounded-xl px-4 py-3 space-y-2"
      style={{ border: "1px solid rgba(110,231,183,0.15)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            <span>{label}</span>
            <span className="text-muted-foreground font-normal">.{parentLabel}.humanens.eth</span>
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
        {status === "success" ? (
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
        ) : error ? (
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            Failed
          </span>
        ) : (
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold animate-pulse"
            style={{
              background: "rgba(251,191,36,0.1)",
              color: "#FBbf24",
              border: "1px solid rgba(251,191,36,0.2)",
            }}
          >
            Creating...
          </span>
        )}
      </div>

      {error ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive flex-1">{error}</p>
          <button
            onClick={onRetry}
            className="shrink-0 h-7 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Retry
          </button>
        </div>
      ) : status !== "success" ? (
        <div className="flex items-center gap-2">
          <div
            className="h-1 flex-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: "linear-gradient(90deg, #6EE7B7, #3889FF)",
                width: status === "attesting" ? "33%" : status === "sending" ? "66%" : "100%",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground shrink-0 animate-pulse">
            {statusLabel[status] ?? "Processing..."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ---- Manage flow ----
function ManageFlow() {
  const { labels, isLoading: isLoadingLabels, saveNullifier, needsVerify } = useMyLabels();
  const [selectedLabel, setSelectedLabel] = useState("");
  const submittedLabel = selectedLabel || labels[0] || "";

  const [agentLabel, setAgentLabel] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [erc8004Chain, setErc8004Chain] = useState<number | null>(null);
  const [erc8004AgentId, setErc8004AgentId] = useState("");

  // Track pending agent for the in-list card
  const [pendingAgent, setPendingAgent] = useState<{
    label: string;
    address: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { agents, isLoading, refetch } = useAgents(submittedLabel);
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
    verifyNullifier,
    appId,
    action,
  } = useIdkitVerify();
  const [createIdkitOpen, setCreateIdkitOpen] = useState(false);
  const [identifyIdkitOpen, setIdentifyIdkitOpen] = useState(false);

  const isCreating =
    createStatus !== "idle" && createStatus !== "success" && createStatus !== "error";

  // Auto-select first label when labels load
  useEffect(() => {
    if (labels.length > 0 && !selectedLabel) {
      setSelectedLabel(labels[0]);
    }
  }, [labels, selectedLabel]);

  // Clear pending card + polling once the agent appears in the fetched list
  useEffect(() => {
    if (pendingAgent && agents.some((a) => a.agentLabel === pendingAgent.label)) {
      setPendingAgent(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [agents, pendingAgent]);

  // Clear pending card if creation fails
  useEffect(() => {
    if (pendingAgent && createStatus === "error") {
      setPendingAgent(null);
    }
  }, [createStatus, pendingAgent]);

  async function handleIdentify() {
    await fetchCreateRpContext();
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

  async function handleCreate() {
    await fetchCreateRpContext();
    setCreateIdkitOpen(true);
  }

  function handleCreateIdkitSuccess(result: unknown) {
    if (submittedLabel && agentLabel && agentAddress) {
      const ensip25Key =
        erc8004Chain && erc8004AgentId ? buildENSIP25Key(erc8004Chain, erc8004AgentId) : undefined;

      // Show pending card immediately
      setPendingAgent({ label: agentLabel, address: agentAddress });

      const savedLabel = agentLabel;
      const savedAddress = agentAddress;

      // Clear form right away
      setAgentLabel("");
      setAgentAddress("");
      setErc8004Chain(null);
      setErc8004AgentId("");

      createAgent({
        parentLabel: submittedLabel,
        agentLabel: savedLabel,
        agentAddress: savedAddress as `0x${string}`,
        idkitResult: result,
        ensip25Key,
      }).then((success) => {
        if (!success) {
          setPendingAgent(null);
          createReset();
          return;
        }
        createReset();
        // Poll refetch until the new agent appears in the list
        pollRef.current = setInterval(() => {
          refetch();
        }, 3000);
        // Safety: stop polling after 60s
        setTimeout(() => {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }, 60000);
      });
    }
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

      {/* Identity verification */}
      {needsVerify ? (
        <div className="glass-card animate-fade-in-up delay-100 rounded-xl px-4 py-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Verify your World ID to load your HumanENS names
          </p>
          <button
            onClick={handleIdentify}
            disabled={isLoadingCreateRp}
            className={cn(
              "btn-glow w-full h-10 rounded-full text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]",
              isLoadingCreateRp && "opacity-40 cursor-not-allowed hover:scale-100",
            )}
            style={{
              background: "linear-gradient(135deg, #6EE7B7 0%, #3889FF 50%, #8B5CF6 100%)",
            }}
          >
            {isLoadingCreateRp ? "Loading..." : "Verify Identity"}
          </button>
        </div>
      ) : isLoadingLabels ? (
        <p className="text-sm text-muted-foreground animate-pulse text-center">
          Loading your names...
        </p>
      ) : labels.length === 0 ? (
        <div className="glass-card animate-fade-in-up delay-100 rounded-xl px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            No HumanENS names found. Register one first at /app/claim.
          </p>
        </div>
      ) : (
        <>
          {/* Label selector (if multiple) */}
          {labels.length > 1 && (
            <div className="glass-card animate-fade-in-up delay-100 rounded-xl px-4 py-4 space-y-2">
              <label
                className="block text-[11px] uppercase tracking-[0.5px]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Your HumanENS name
              </label>
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm text-white outline-none"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                {labels.map((l) => (
                  <option key={l} value={l}>
                    {l}.humanens.eth
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Show current label */}
          {labels.length === 1 && (
            <div className="animate-fade-in-up delay-100">
              <p className="text-sm text-muted-foreground">
                Managing agents for{" "}
                <span className="text-white font-medium">{submittedLabel}.humanens.eth</span>
              </p>
            </div>
          )}
        </>
      )}

      {/* Agent list */}
      {submittedLabel && !needsVerify && (
        <>
          <div className="animate-fade-in">
            <h2 className="text-base font-semibold text-white mb-3">
              Active Agents
              {!isLoading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({agents.length}
                  {pendingAgent && createStatus !== "error" ? " + 1" : ""})
                </span>
              )}
            </h2>

            {isLoading && !pendingAgent ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading agents...</p>
            ) : agents.length === 0 && !pendingAgent ? (
              <div className="glass-card rounded-xl px-4 py-4">
                <p className="text-sm text-muted-foreground text-center">
                  No active agents for {submittedLabel}.humanens.eth
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={`${agent.parentLabel}:${agent.agentLabel}`}
                    agent={agent}
                    onRevoked={refetch}
                  />
                ))}
                {pendingAgent && (
                  <PendingAgentCard
                    label={pendingAgent.label}
                    parentLabel={submittedLabel}
                    address={pendingAgent.address}
                    status={createStatus}
                    error={createError}
                    onRetry={() => {
                      createReset();
                      setPendingAgent(null);
                    }}
                  />
                )}
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
                  <span className="text-xs text-muted-foreground truncate min-w-0">
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

              <div className="flex gap-2">
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
        <>
          <IDKitRequestWidget
            open={identifyIdkitOpen}
            onOpenChange={setIdentifyIdkitOpen}
            app_id={appId as `app_${string}`}
            action={action}
            rp_context={createRpContext}
            allow_legacy_proofs={true}
            preset={deviceLegacy()}
            onSuccess={handleIdentifySuccess}
            onError={(code) => console.error("IDKit identify error", code)}
          />
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
        </>
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
