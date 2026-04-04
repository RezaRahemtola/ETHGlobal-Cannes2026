import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { addEnsContracts } from "@ensdomains/ensjs";
import { getTextRecord, getName, getResolver } from "@ensdomains/ensjs/public";

export const ensClient = createPublicClient({
  chain: addEnsContracts(mainnet),
  transport: http("https://ethereum-rpc.publicnode.com"),
});

export async function getEnsTextRecord(name: string, key: string) {
  return getTextRecord(ensClient, { name, key });
}

export async function getEnsResolver(name: string): Promise<`0x${string}` | null> {
  const resolver = await getResolver(ensClient, { name });
  return resolver ?? null;
}

export async function getEnsNamesForAddress(address: `0x${string}`) {
  const names: string[] = [];

  // Try primary name first
  try {
    const primary = await getName(ensClient, { address });
    if (primary?.name) names.push(primary.name);
  } catch {
    // Primary lookup failed
  }

  // Query ENS subgraph for all owned/registered names
  const subgraphUrls = [
    "https://api.thegraph.com/subgraphs/name/ensdomains/ens",
    "https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH",
  ];

  const addr = address.toLowerCase();
  // Query both regular domains AND wrapped domains (NameWrapper)
  const query = JSON.stringify({
    query: `{
      domains(where: { owner: "${addr}", name_not: null }, first: 50) { name }
      wrappedDomains(where: { owner: "${addr}" }, first: 50) { domain { name } }
    }`,
  });

  for (const url of subgraphUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: query,
      });
      const data = await response.json();
      if (data?.data) {
        // Regular (unwrapped) domains
        for (const domain of data.data.domains ?? []) {
          if (domain.name?.endsWith(".eth") && !names.includes(domain.name)) {
            names.push(domain.name);
          }
        }
        // Wrapped domains via NameWrapper
        for (const wrapped of data.data.wrappedDomains ?? []) {
          const name = wrapped.domain?.name;
          if (name?.endsWith(".eth") && !names.includes(name)) {
            names.push(name);
          }
        }
        break; // Success — don't try next URL
      }
    } catch {
      continue; // Try next URL
    }
  }

  return names;
}
