import express from "express";
import {
  type Hex,
  keccak256,
  encodePacked,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Config ──────────────────────────────────────────────────────────

const BACKEND_SIGNER_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as Hex;
if (!BACKEND_SIGNER_KEY) throw new Error("BACKEND_SIGNER_PRIVATE_KEY required");

const WORLD_ID_RP_ID = process.env.WORLD_ID_RP_ID || "rp_xxxxx";
const WORLD_ID_ACTION = process.env.WORLD_ID_ACTION || "verify-human";
const PORT = Number(process.env.PORT) || 3002;

const account = privateKeyToAccount(BACKEND_SIGNER_KEY);

// ─── World ID cloud verification ────────────────────────────────────

async function verifyWorldId(idkitResult: any): Promise<{ nullifierHash: string }> {
  const res = await fetch(
    `https://developer.world.org/api/v4/verify/${WORLD_ID_RP_ID}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResult),
    }
  );

  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(`World ID verification failed: ${payload.detail || payload.code || "unknown"}`);
  }

  return { nullifierHash: payload.nullifier };
}

// ─── Sign attestation ────────────────────────────────────────────────

async function signAttestation(
  registrant: Hex,
  nullifierHash: Hex,
  sourceNode: Hex,
  label: string,
  timestamp: bigint
): Promise<Hex> {
  // Must match contract: keccak256(abi.encodePacked(registrant, nullifierHash, sourceNode, label, timestamp))
  const hash = keccak256(
    encodePacked(
      ["address", "bytes32", "bytes32", "string", "uint256"],
      [registrant, nullifierHash, sourceNode, label, timestamp]
    )
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
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
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
      return res.status(400).json({ error: "Missing fields: idkitResult, registrant, sourceNode, label" });
    }

    // Step 1: Verify World ID proof via cloud API
    const { nullifierHash } = await verifyWorldId(idkitResult);
    console.log(`Verified World ID for ${label} — nullifier: ${nullifierHash.slice(0, 10)}...`);

    // Step 2: Sign attestation for the Linker contract
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signature = await signAttestation(
      registrant as Hex,
      nullifierHash as Hex,
      sourceNode as Hex,
      label,
      timestamp
    );

    res.json({
      nullifierHash,
      timestamp: timestamp.toString(),
      signature,
    });
  } catch (err: any) {
    console.error("Verification error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/sign-attestation
 *
 * For actions that don't need fresh World ID verification (revoke, agent ops).
 * The nullifier is already known — just sign a fresh attestation.
 *
 * Body: { registrant, nullifierHash, sourceNode, label }
 * (In production, you'd re-verify World ID here too. For hackathon, trust the nullifier.)
 */
app.post("/api/sign-attestation", async (req, res) => {
  try {
    const { registrant, nullifierHash, sourceNode, label } = req.body;

    if (!registrant || !nullifierHash) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signature = await signAttestation(
      registrant as Hex,
      nullifierHash as Hex,
      (sourceNode || "0x" + "00".repeat(32)) as Hex,
      label || "",
      timestamp
    );

    res.json({
      nullifierHash,
      timestamp: timestamp.toString(),
      signature,
    });
  } catch (err: any) {
    console.error("Signing error:", err.message);
    res.status(500).json({ error: err.message });
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
