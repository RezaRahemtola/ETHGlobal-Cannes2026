import {
  createPublicClient,
  http,
  decodeErrorResult,
  encodeFunctionData,
  type Hex,
} from "viem";
import { humanENSLinkerABI } from "./contracts";
import { HUMANENS_LINKER_ADDRESS } from "./constants";

const worldchain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] },
  },
} as const;

const client = createPublicClient({
  chain: worldchain,
  transport: http(),
});

/**
 * Orchestrates CCIP-Read for registerLink:
 * 1. Simulate registerLink() → catch OffchainLookup
 * 2. Fetch from gateway
 * 3. Return encoded registerLinkCallback calldata for MiniKit
 */
export async function buildRegisterLinkCalldata(args: {
  label: string;
  sourceName: string;
  sourceNode: Hex;
  attestationData: Hex;
  sender: `0x${string}`;
}): Promise<Hex> {
  // Step 1: Simulate to get OffchainLookup revert
  const callData = encodeFunctionData({
    abi: humanENSLinkerABI,
    functionName: "registerLink",
    args: [args.label, args.sourceName, args.sourceNode, args.attestationData],
  });

  let offchainData: {
    urls: string[];
    callData: Hex;
    callbackSelector: Hex;
    extraData: Hex;
  };

  try {
    await client.call({
      to: HUMANENS_LINKER_ADDRESS,
      data: callData,
      account: args.sender,
    });
    throw new Error("Expected OffchainLookup revert");
  } catch (err: unknown) {
    const error = err as { data?: Hex };
    if (!error.data) throw err;

    const decoded = decodeErrorResult({
      abi: humanENSLinkerABI,
      data: error.data,
    });

    if (decoded.errorName !== "OffchainLookup") {
      throw new Error(`Unexpected error: ${decoded.errorName}`);
    }

    const [, urls, cData, callbackSelector, extraData] =
      decoded.args as unknown as [string, string[], Hex, Hex, Hex];

    offchainData = { urls, callData: cData, callbackSelector, extraData };
  }

  // Step 2: Fetch from gateway
  const url = offchainData.urls[0]
    .replace("{sender}", HUMANENS_LINKER_ADDRESS)
    .replace("{data}", offchainData.callData);

  const gatewayResponse = await fetch(url);
  if (!gatewayResponse.ok) {
    throw new Error(`Gateway error: ${gatewayResponse.status}`);
  }
  const { data: responseData } = (await gatewayResponse.json()) as {
    data: Hex;
  };

  // Step 3: Encode callback calldata
  return encodeFunctionData({
    abi: humanENSLinkerABI,
    functionName: "registerLinkCallback",
    args: [responseData, offchainData.extraData],
  });
}

/**
 * Same as buildRegisterLinkCalldata but returns raw args for MiniKit Transaction format.
 */
export async function buildRegisterLinkCallbackArgs(args: {
  label: string;
  sourceName: string;
  sourceNode: Hex;
  attestationData: Hex;
  sender: `0x${string}`;
}): Promise<[Hex, Hex]> {
  const callData = encodeFunctionData({
    abi: humanENSLinkerABI,
    functionName: "registerLink",
    args: [args.label, args.sourceName, args.sourceNode, args.attestationData],
  });

  let offchainData: {
    urls: string[];
    callData: Hex;
    callbackSelector: Hex;
    extraData: Hex;
  };

  try {
    await client.call({
      to: HUMANENS_LINKER_ADDRESS,
      data: callData,
      account: args.sender,
    });
    throw new Error("Expected OffchainLookup revert");
  } catch (err: unknown) {
    const error = err as { data?: Hex };
    if (!error.data) throw err;

    const decoded = decodeErrorResult({
      abi: humanENSLinkerABI,
      data: error.data,
    });

    if (decoded.errorName !== "OffchainLookup") {
      throw new Error(`Unexpected error: ${decoded.errorName}`);
    }

    const [, urls, cData, callbackSelector, extraData] =
      decoded.args as unknown as [string, string[], Hex, Hex, Hex];

    offchainData = { urls, callData: cData, callbackSelector, extraData };
  }

  const url = offchainData.urls[0]
    .replace("{sender}", HUMANENS_LINKER_ADDRESS)
    .replace("{data}", offchainData.callData);

  const gatewayResponse = await fetch(url);
  if (!gatewayResponse.ok) {
    throw new Error(`Gateway error: ${gatewayResponse.status}`);
  }
  const { data: responseData } = (await gatewayResponse.json()) as {
    data: Hex;
  };

  return [responseData, offchainData.extraData];
}
