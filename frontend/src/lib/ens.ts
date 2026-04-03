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
  const primary = await getName(ensClient, { address });
  return primary?.name ? [primary.name] : [];
}
