"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, namehash, parseAbiItem } from "viem";
import { HUMANENS_LINKER_ADDRESS } from "@/lib/constants";
import { humanENSLinkerABI } from "@/lib/contracts";
import { lookupAgentBook } from "./use-agentbook";

const worldchain = {
  id: 480 as const,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
};

const client = createPublicClient({
  chain: worldchain,
  transport: http(),
});

export interface Agent {
  parentLabel: string;
  agentLabel: string;
  agentAddress: string;
  fullName: string;
  agentBookRegistered: boolean;
}

export function useAgents(parentLabel: string) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    if (!parentLabel) return;

    setIsLoading(true);

    async function fetchAgents() {
      try {
        const createdLogs = await client.getLogs({
          address: HUMANENS_LINKER_ADDRESS,
          event: parseAbiItem(
            "event AgentCreated(string parentLabel, string agentLabel, address agentAddress)",
          ),
          fromBlock: BigInt(0),
          toBlock: "latest",
        });

        const revokedLogs = await client.getLogs({
          address: HUMANENS_LINKER_ADDRESS,
          event: parseAbiItem("event AgentRevoked(string parentLabel, string agentLabel)"),
          fromBlock: BigInt(0),
          toBlock: "latest",
        });

        // Track latest block per agent key for revocations (handles create→revoke→re-create)
        const lastRevokeBlock = new Map<string, bigint>();
        for (const l of revokedLogs) {
          if (l.args.parentLabel !== parentLabel) continue;
          const key = `${l.args.parentLabel}:${l.args.agentLabel}`;
          const prev = lastRevokeBlock.get(key);
          if (!prev || l.blockNumber > prev) {
            lastRevokeBlock.set(key, l.blockNumber);
          }
        }

        // An agent is active if its latest create came after its latest revoke
        const latestCreate = new Map<string, (typeof createdLogs)[number]>();
        for (const l of createdLogs) {
          if (l.args.parentLabel !== parentLabel) continue;
          const key = `${l.args.parentLabel}:${l.args.agentLabel}`;
          const prev = latestCreate.get(key);
          if (!prev || l.blockNumber > prev.blockNumber) {
            latestCreate.set(key, l);
          }
        }

        const activeAgentLogs = [...latestCreate.entries()]
          .filter(([key, l]) => {
            const revokedAt = lastRevokeBlock.get(key);
            return !revokedAt || l.blockNumber > revokedAt;
          })
          .map(([, l]) => l);

        const agentsWithStatus = (
          await Promise.all(
            activeAgentLogs.map(async (l) => {
              const pLabel = l.args.parentLabel!;
              const aLabel = l.args.agentLabel!;
              const addr = l.args.agentAddress! as `0x${string}`;
              // Check if agent is still active on-chain (not cleared by _clearLink)
              const agentNode = namehash(`${aLabel}.${pLabel}.humanens.eth`);
              try {
                const parentNullifier = await client.readContract({
                  address: HUMANENS_LINKER_ADDRESS,
                  abi: humanENSLinkerABI,
                  functionName: "agentToParentNullifier",
                  args: [agentNode as `0x${string}`],
                });
                if (
                  parentNullifier ===
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
                ) {
                  return null; // Zombie agent — cleared by _clearLink
                }
              } catch {
                return null;
              }
              let agentBookRegistered = false;
              try {
                const humanId = await lookupAgentBook(addr);
                agentBookRegistered = humanId !== BigInt(0);
              } catch {
                // AgentBook lookup failed, assume not registered
              }
              return {
                parentLabel: pLabel,
                agentLabel: aLabel,
                agentAddress: addr as string,
                fullName: `${aLabel}.${pLabel}.humanens.eth`,
                agentBookRegistered,
              };
            }),
          )
        ).filter((a): a is Agent => a !== null);

        setAgents(agentsWithStatus);
      } catch {
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgents();
  }, [parentLabel, fetchKey]);

  function refetch() {
    setFetchKey((k) => k + 1);
  }

  return { agents, isLoading, refetch };
}
