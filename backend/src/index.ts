import express from "express";
import { type Hex, keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ──────────────────────────────────────────────────────────

const BACKEND_SIGNER_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as Hex;
if (!BACKEND_SIGNER_KEY) throw new Error("BACKEND_SIGNER_PRIVATE_KEY required");

const WORLD_ID_RP_ID = process.env.WORLD_ID_RP_ID || "rp_xxxxx";
const WORLD_ID_ACTION = process.env.WORLD_ID_ACTION || "verify-human";
const PORT = Number(process.env.PORT) || 3002;

const account = privateKeyToAccount(BACKEND_SIGNER_KEY);

// ─── World ID cloud verification ────────────────────────────────────

async function verifyWorldId(idkitResult: unknown): Promise<{ nullifierHash: string }> {
  // Verify action matches our expected action
  const result = idkitResult as Record<string, unknown>;
  if (result.action !== WORLD_ID_ACTION) {
    throw new Error(`Action mismatch: expected "${WORLD_ID_ACTION}", got "${result.action}"`);
  }

  const res = await fetch(`https://developer.world.org/api/v4/verify/${WORLD_ID_RP_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(idkitResult),
  });

  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(`World ID verification failed: ${payload.detail || payload.code || "unknown"}`);
  }

  return { nullifierHash: payload.nullifier };
}

// ─── Sign attestation ────────────────────────────────────────────────

async function signAttestation(
  action: string,
  registrant: Hex,
  nullifierHash: Hex,
  sourceNode: Hex,
  label: string,
  timestamp: bigint,
): Promise<Hex> {
  // Must match contract: keccak256(abi.encodePacked(action, registrant, nullifierHash, sourceNode, label, timestamp))
  const hash = keccak256(
    encodePacked(
      ["string", "address", "bytes32", "bytes32", "string", "uint256"],
      [action, registrant, nullifierHash, sourceNode, label, timestamp],
    ),
  );
  return account.signMessage({ message: { raw: hash } });
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

/**
 * POST /api/verify-and-attest
 *
 * Body: {
 *   idkitResult: <raw IDKit result payload>,
 *   registrant: "0x...",      // user's wallet address
 *   sourceNode: "0x...",      // namehash of alice.eth
 *   label: "alice"            // desired subname label
 * }
 *
 * Returns: {
 *   nullifierHash, timestamp, signature,
 *   attestationData  // abi.encode(nullifierHash, timestamp, signature) — ready for contract
 * }
 */
app.post("/api/verify-and-attest", async (req, res) => {
  try {
    const { idkitResult, registrant, sourceNode, label } = req.body;

    if (!idkitResult || !registrant || !sourceNode || !label) {
      return res
        .status(400)
        .json({ error: "Missing fields: idkitResult, registrant, sourceNode, label" });
    }

    // Step 1: Verify World ID proof via cloud API
    const { nullifierHash } = await verifyWorldId(idkitResult);
    console.log(`Verified World ID for ${label} — nullifier: ${nullifierHash.slice(0, 10)}...`);

    // Step 2: Sign attestation for the Linker contract
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signature = await signAttestation(
      "register",
      registrant as Hex,
      nullifierHash as Hex,
      sourceNode as Hex,
      label,
      timestamp,
    );

    // ABI-encode for the contract: abi.encode(nullifierHash, timestamp, signature)
    const attestationData = encodeAbiParameters(parseAbiParameters("bytes32, uint256, bytes"), [
      nullifierHash as Hex,
      timestamp,
      signature,
    ]);

    res.json({
      nullifierHash,
      timestamp: timestamp.toString(),
      signature,
      attestationData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verification error:", message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/verify-and-sign-revoke
 * Body: { idkitResult, registrant, nullifierHash, sourceNode, label }
 * Hash: keccak256(abi.encodePacked(registrant, nullifierHash, sourceNode, label, timestamp))
 */
app.post("/api/verify-and-sign-revoke", async (req, res) => {
  try {
    const { idkitResult, registrant, sourceNode, label } = req.body;
    if (!idkitResult || !registrant || !sourceNode || !label) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const signature = await signAttestation(
      "revoke",
      registrant as Hex,
      nullifierHash as Hex,
      sourceNode as Hex,
      label,
      timestamp,
    );

    res.json({ nullifierHash, timestamp: timestamp.toString(), signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Revoke signing error:", message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/verify-and-sign-agent
 * Body: { idkitResult, registrant, parentLabel, agentLabel, agentAddress }
 * Hash: keccak256(abi.encodePacked(registrant, nullifierHash, parentLabel, agentLabel, agentAddress, timestamp))
 */
app.post("/api/verify-and-sign-agent", async (req, res) => {
  try {
    const { idkitResult, registrant, parentLabel, agentLabel, agentAddress } = req.body;
    if (!idkitResult || !registrant || !parentLabel || !agentLabel || !agentAddress) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const hash = keccak256(
      encodePacked(
        ["string", "address", "bytes32", "string", "string", "address", "uint256"],
        [
          "createAgent",
          registrant as Hex,
          nullifierHash as Hex,
          parentLabel,
          agentLabel,
          agentAddress as Hex,
          timestamp,
        ],
      ),
    );
    const signature = await account.signMessage({ message: { raw: hash } });

    res.json({ nullifierHash, timestamp: timestamp.toString(), signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Agent signing error:", message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/verify-and-sign-revoke-agent
 * Body: { idkitResult, registrant, parentLabel, agentLabel }
 * Hash: keccak256(abi.encodePacked(registrant, nullifierHash, parentLabel, agentLabel, timestamp))
 */
app.post("/api/verify-and-sign-revoke-agent", async (req, res) => {
  try {
    const { idkitResult, registrant, parentLabel, agentLabel } = req.body;
    if (!idkitResult || !registrant || !parentLabel || !agentLabel) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const hash = keccak256(
      encodePacked(
        ["string", "address", "bytes32", "string", "string", "uint256"],
        [
          "revokeAgent",
          registrant as Hex,
          nullifierHash as Hex,
          parentLabel,
          agentLabel,
          timestamp,
        ],
      ),
    );
    const signature = await account.signMessage({ message: { raw: hash } });

    res.json({ nullifierHash, timestamp: timestamp.toString(), signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Revoke agent signing error:", message);
    res.status(400).json({ error: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", signer: account.address, action: WORLD_ID_ACTION });
});

app.listen(PORT, () => {
  console.log(`World ID Backend running on :${PORT}`);
  console.log(`Signer: ${account.address}`);
  console.log(`RP ID: ${WORLD_ID_RP_ID}`);
});
