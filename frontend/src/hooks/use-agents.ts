"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { HUMANENS_LINKER_ADDRESS } from "@/lib/constants";
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

        const revokedSet = new Set(
          revokedLogs.map((l) => `${l.args.parentLabel}:${l.args.agentLabel}`),
        );

        const activeAgentLogs = createdLogs.filter(
          (l) =>
            l.args.parentLabel === parentLabel &&
            !revokedSet.has(`${l.args.parentLabel}:${l.args.agentLabel}`),
        );

        const agentsWithStatus = await Promise.all(
          activeAgentLogs.map(async (l) => {
            const addr = l.args.agentAddress! as `0x${string}`;
            let agentBookRegistered = false;
            try {
              const humanId = await lookupAgentBook(addr);
              agentBookRegistered = humanId !== 0n;
            } catch {
              // AgentBook lookup failed, assume not registered
            }
            return {
              parentLabel: l.args.parentLabel!,
              agentLabel: l.args.agentLabel!,
              agentAddress: l.args.agentAddress!,
              fullName: `${l.args.agentLabel}.${l.args.parentLabel}.humanens.eth`,
              agentBookRegistered,
            };
          }),
        );

        setAgents(agentsWithStatus);
      } catch {
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgents();
  }, [parentLabel]);

  return { agents, isLoading };
}
