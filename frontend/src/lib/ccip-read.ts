import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { HUMANENS_LINKER_ADDRESS } from "./constants";

const GATEWAY_URL = "https://humanens-gateway.reza.dev/{sender}/{data}.json";

/**
 * Orchestrates CCIP-Read for registerLink without simulating the contract.
 * We know exactly what registerLink() returns in its OffchainLookup revert,
 * so we construct the gateway request and extraData directly.
 */
export async function buildRegisterLinkCallbackArgs(args: {
  label: string;
  sourceName: string;
  sourceNode: Hex;
  attestationData: Hex;
}): Promise<[Hex, Hex]> {
  // Build the gateway callData: abi.encode(sourceNode, "humanens", sourceName)
  const gatewayCallData = encodeAbiParameters(parseAbiParameters("bytes32, string, string"), [
    args.sourceNode,
    "humanens",
    args.sourceName,
  ]);

  // Build the extraData: abi.encode(label, sourceNode, sourceName, attestationData)
  const extraData = encodeAbiParameters(parseAbiParameters("string, bytes32, string, bytes"), [
    args.label,
    args.sourceNode,
    args.sourceName,
    args.attestationData,
  ]);

  // Fetch from gateway
  const url = GATEWAY_URL.replace("{sender}", HUMANENS_LINKER_ADDRESS).replace(
    "{data}",
    gatewayCallData,
  );

  const gatewayResponse = await fetch(url);
  if (!gatewayResponse.ok) {
    throw new Error(`Gateway error: ${gatewayResponse.status}`);
  }
  const { data: responseData } = (await gatewayResponse.json()) as { data: Hex };

  return [responseData, extraData];
}
