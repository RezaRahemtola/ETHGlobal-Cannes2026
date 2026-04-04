import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, arbitrum, optimism, polygon, linea, scroll } from "viem/chains";
import { config } from "dotenv";

config();

const ERC8004_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  linea,
  scroll,
};

const registryAbi = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] || "";
      i++;
    }
  }
  return flags;
}

function usage() {
  console.log(`Usage: npm run register -- \\
  --chain <ethereum|base|arbitrum|optimism|polygon|linea|scroll> \\
  --ens <name.eth>            ENS name for the agent \\
  --name <string>             Agent name \\
  --description <string>      Agent description \\
  --rpc <url>                 (optional) Custom RPC`);
  process.exit(1);
}

function buildAgentDataURI(opts: {
  name: string;
  description: string;
  ens: string;
  chainId: number;
}): string {
  // agentId is unknown before registration, will be set via setAgentURI after
  const agentFile = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: opts.name,
    description: opts.description,
    image: "",
    services: [
      { name: "ENS", endpoint: opts.ens },
    ],
    x402Support: false,
    active: true,
    registrations: [] as { agentId: number; agentRegistry: string }[],
    supportedTrust: [],
  };

  const json = JSON.stringify(agentFile);
  const b64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${b64}`;
}

async function main() {
  const flags = parseArgs();

  const chainName = flags["chain"];
  const rpcUrl = flags["rpc"];
  const ensName = flags["ens"];
  const agentName = flags["name"] || "Agent";
  const agentDescription = flags["description"] || "";

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("Missing PRIVATE_KEY env variable");
    process.exit(1);
  }

  if (!chainName || !ensName) usage();

  const chain = CHAINS[chainName.toLowerCase()];
  if (!chain) {
    console.error(`Unknown chain: ${chainName}. Supported: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`Account: ${account.address}`);
  console.log(`Chain:   ${chain.name} (${chain.id})`);
  console.log(`ENS:     ${ensName}`);

  // Build initial data URI (without agentId in registrations)
  const dataUri = buildAgentDataURI({
    name: agentName,
    description: agentDescription,
    ens: ensName,
    chainId: chain.id,
  });

  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  // Register
  console.log("\nRegistering agent on ERC-8004...");
  const txHash = await walletClient.writeContract({
    address: ERC8004_REGISTRY,
    abi: registryAbi,
    functionName: "register",
    args: [dataUri],
  });
  console.log(`  tx: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`  confirmed in block ${receipt.blockNumber}`);

  // Registered(uint256 indexed agentId, string agentURI, address indexed owner)
  const REGISTERED_TOPIC = "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";
  const registeredLog = receipt.logs.find(
    (log) => log.topics[0] === REGISTERED_TOPIC
  );
  const agentId = registeredLog ? Number(BigInt(registeredLog.topics[1]!)) : undefined;
  if (!agentId) {
    console.error("Could not extract agentId from tx logs");
    process.exit(1);
  }
  console.log(`  agentId: ${agentId}`);

  // Update tokenURI with real agentId + registrations
  console.log("\nUpdating agent URI with agentId...");
  const finalFile = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: agentName,
    description: agentDescription,
    image: "",
    services: [
      { name: "ENS", endpoint: ensName },
    ],
    x402Support: false,
    active: true,
    registrations: [
      { agentId, agentRegistry: `eip155:${chain.id}:${ERC8004_REGISTRY}` },
    ],
    supportedTrust: [],
  };

  const finalB64 = Buffer.from(JSON.stringify(finalFile)).toString("base64");
  const finalUri = `data:application/json;base64,${finalB64}`;

  const setUriAbi = parseAbi(["function setAgentURI(uint256 agentId, string newURI) external"]);
  const setTx = await walletClient.writeContract({
    address: ERC8004_REGISTRY,
    abi: setUriAbi,
    functionName: "setAgentURI",
    args: [BigInt(agentId), finalUri],
  });
  console.log(`  tx: ${setTx}`);

  const setReceipt = await publicClient.waitForTransactionReceipt({ hash: setTx });
  console.log(`  confirmed in block ${setReceipt.blockNumber}`);

  console.log(`\nDone! Agent #${agentId} registered on ${chain.name} with ENS ${ensName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
