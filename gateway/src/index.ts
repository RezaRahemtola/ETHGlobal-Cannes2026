import express from "express";
import {
  createPublicClient,
  http,
  namehash,
  type Hex,
  encodeAbiParameters,
  parseAbiParameters,
  decodeAbiParameters,
  keccak256,
  encodePacked,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ──────────────────────────────────────────────────────────

const GATEWAY_SIGNER_KEY = process.env.GATEWAY_SIGNER_PRIVATE_KEY as Hex;
if (!GATEWAY_SIGNER_KEY) throw new Error("GATEWAY_SIGNER_PRIVATE_KEY required");

const ETH_RPC = process.env.ETH_RPC_URL;
if (!ETH_RPC) throw new Error("ETH_RPC_URL required");
const PORT = Number(process.env.PORT) || 3001;

const account = privateKeyToAccount(GATEWAY_SIGNER_KEY);
const ethClient = createPublicClient({ chain: mainnet, transport: http(ETH_RPC) });

const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as const;
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

const OWNER_ABI = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const OWNER_OF_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/// Returns the actual human owner of an ENS name.
/// For wrapped names: NameWrapper.ownerOf(node)
/// For unwrapped names: Registry.owner(node)
async function getEnsNftOwner(node: Hex): Promise<Hex> {
  const registryOwner = (await ethClient.readContract({
    address: ENS_REGISTRY,
    abi: OWNER_ABI,
    functionName: "owner",
    args: [node],
  })) as Hex;

  // If the registry owner is the NameWrapper, the real owner is inside the wrapper
  if (registryOwner.toLowerCase() === NAME_WRAPPER.toLowerCase()) {
    const wrapperOwner = (await ethClient.readContract({
      address: NAME_WRAPPER,
      abi: OWNER_OF_ABI,
      functionName: "ownerOf",
      args: [BigInt(node)],
    })) as Hex;
    return wrapperOwner;
  }

  return registryOwner;
}

// ─── Core logic ──────────────────────────────────────────────────────

async function handleRequest(callData: Hex) {
  // Decode: abi.encode(bytes32 sourceNode, string key, string name)
  const [sourceNode, key, ensName] = decodeAbiParameters(
    parseAbiParameters("bytes32, string, string"),
    callData,
  );

  // Validate inputs
  if (key !== "humanens") {
    throw new Error(`Invalid key: expected "humanens", got "${key}"`);
  }
  const expectedNode = namehash(ensName);
  if (expectedNode !== sourceNode) {
    throw new Error(
      `sourceNode mismatch: expected ${expectedNode} for ${ensName}, got ${sourceNode}`,
    );
  }

  console.log(`Checking ${ensName} text record "${key}"`);

  // Read L1 ENS state in parallel
  const [value, ensOwner] = await Promise.all([
    ethClient.getEnsText({ name: ensName, key }).then((v) => v ?? ""),
    getEnsNftOwner(sourceNode as Hex),
  ]);

  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  // Sign: must match contract's keccak256(abi.encodePacked(sourceNode, value, ensOwner, timestamp))
  const hash = keccak256(
    encodePacked(
      ["bytes32", "string", "address", "uint256"],
      [sourceNode as Hex, value, ensOwner as Hex, timestamp],
    ),
  );
  const signature = await account.signMessage({ message: { raw: hash } });

  // Encode response: abi.encode(bytes32, string, address, uint256, bytes)
  return encodeAbiParameters(parseAbiParameters("bytes32, string, address, uint256, bytes"), [
    sourceNode as Hex,
    value,
    ensOwner as Hex,
    timestamp,
    signature,
  ]);
}

// ─── Server ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// EIP-3668 GET: /{sender}/{data}.json
app.get("/:sender/:data.json", async (req, res) => {
  try {
    const data = req.params.data;
    if (!data || !/^0x[0-9a-fA-F]+$/.test(data)) {
      res.status(400).json({ error: "Invalid calldata" });
      return;
    }
    const responseData = await handleRequest(data as Hex);
    res.json({ data: responseData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Gateway error:", message);
    res.status(500).json({ error: "Internal gateway error" });
  }
});

// EIP-3668 POST fallback
app.post("/", async (req, res) => {
  try {
    const responseData = await handleRequest(req.body.data as Hex);
    res.json({ data: responseData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Gateway error:", message);
    res.status(500).json({ error: "Internal gateway error" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", signer: account.address });
});

app.listen(PORT, () => {
  console.log(`ENS Ownership Gateway running on :${PORT}`);
  console.log(`Signer: ${account.address}`);
});
