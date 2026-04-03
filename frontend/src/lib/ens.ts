import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { addEnsContracts } from "@ensdomains/ensjs";
import { getTextRecord, getName } from "@ensdomains/ensjs/public";

export const ensClient = createPublicClient({
  chain: addEnsContracts(mainnet),
  transport: http(),
});

export async function getEnsTextRecord(name: string, key: string) {
  return getTextRecord(ensClient, { name, key });
}

export async function getEnsNamesForAddress(address: `0x${string}`) {
  // First try primary name
  const primary = await getName(ensClient, { address });
  const names: string[] = primary?.name ? [primary.name] : [];

  // Also query ENS subgraph for all owned names
  try {
    const response = await fetch(
      "https://gateway.thegraph.com/api/subgraphs/id/5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{
            domains(where: { owner: "${address.toLowerCase()}", name_ends_with: ".eth", name_not: null }) {
              name
            }
          }`,
        }),
      },
    );
    const data = await response.json();
    if (data?.data?.domains) {
      for (const domain of data.data.domains) {
        if (domain.name && !names.includes(domain.name)) {
          names.push(domain.name);
        }
      }
    }
  } catch {
    // Subgraph unavailable, fall back to primary only
  }

  return names;
}
