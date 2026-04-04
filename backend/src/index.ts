import express from "express";
import { type Hex, keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signRequest } from "@worldcoin/idkit-core/signing";

// ─── Config ──────────────────────────────────────────────────────────

const BACKEND_SIGNER_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY as Hex;
if (!BACKEND_SIGNER_KEY) throw new Error("BACKEND_SIGNER_PRIVATE_KEY required");

const WORLD_ID_RP_ID = process.env.WORLD_ID_RP_ID || "rp_xxxxx";
const WORLD_ID_ACTION = process.env.WORLD_ID_ACTION || "humanens";
const PORT = Number(process.env.PORT) || 3002;

const RP_SIGNING_KEY = process.env.RP_SIGNING_KEY as string;
if (!RP_SIGNING_KEY) throw new Error("RP_SIGNING_KEY required");

const account = privateKeyToAccount(BACKEND_SIGNER_KEY);

// ─── World ID cloud verification ────────────────────────────────────

async function verifyWorldId(idkitResult: unknown): Promise<{ nullifierHash: string }> {
  const res = await fetch(`https://developer.world.org/api/v4/verify/${WORLD_ID_RP_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(idkitResult),
  });

  const payload = await res.json();
  console.log("World ID v4 verify response:", JSON.stringify(payload, null, 2));
  if (!res.ok || !payload.success) {
    throw new Error(`World ID verification failed: ${payload.detail || payload.code || "unknown"}`);
  }

  const nullifierHash = payload.nullifier_hash ?? payload.nullifier;
  if (!nullifierHash) {
    throw new Error(`No nullifier in response. Keys: ${Object.keys(payload).join(", ")}`);
  }

  return { nullifierHash };
}

// ─── Sign attestation ────────────────────────────────────────────────

async function signAttestation(
  action: string,
  nullifierHash: Hex,
  sourceNode: Hex,
  label: string,
  level: string,
  timestamp: bigint,
): Promise<Hex> {
  // Must match contract: keccak256(abi.encodePacked(action, nullifierHash, sourceNode, label, level, timestamp))
  const hash = keccak256(
    encodePacked(
      ["string", "bytes32", "bytes32", "string", "string", "uint256"],
      [action, nullifierHash, sourceNode, label, level, timestamp],
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

app.post("/api/rp-signature", async (req, res) => {
  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: RP_SIGNING_KEY,
      action: WORLD_ID_ACTION,
    });

    res.json({
      sig,
      nonce,
      created_at: Number(createdAt),
      expires_at: Number(expiresAt),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("RP signature error:", message);
    res.status(500).json({ error: message });
  }
});

app.post("/api/verify-nullifier", async (req, res) => {
  try {
    const { idkitResult } = req.body;
    if (!idkitResult) {
      return res.status(400).json({ error: "Missing idkitResult" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    console.log(`Verified nullifier for text record: ${nullifierHash.slice(0, 10)}...`);

    res.json({ nullifierHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verify nullifier error:", message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/verify-and-attest
 *
 * Body: {
 *   idkitResult: <raw IDKit result payload>,
 *   sourceNode: "0x...",      // namehash of alice.eth
 *   label: "alice",           // desired subname label
 *   level: "orb"              // World ID verification level
 * }
 *
 * Returns: {
 *   nullifierHash, timestamp, signature,
 *   attestationData  // abi.encode(nullifierHash, level, timestamp, signature) — ready for contract
 * }
 */
app.post("/api/verify-and-attest", async (req, res) => {
  try {
    const { idkitResult, sourceNode, label, level } = req.body;

    if (!idkitResult || !sourceNode || !label || !level) {
      const missing = [
        !idkitResult && "idkitResult",
        !sourceNode && "sourceNode",
        !label && "label",
        !level && "level",
      ].filter(Boolean);
      console.error("verify-and-attest missing fields:", missing.join(", "));
      return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
    }

    // Step 1: Verify World ID proof via cloud API
    const { nullifierHash } = await verifyWorldId(idkitResult);
    console.log(
      `Verified World ID for ${label} (${level}) — nullifier: ${nullifierHash.slice(0, 10)}...`,
    );

    // Step 2: Sign attestation for the Linker contract
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const signature = await signAttestation(
      "register",
      nullifierHash as Hex,
      sourceNode as Hex,
      label,
      level,
      timestamp,
    );

    // ABI-encode for the contract: abi.encode(nullifierHash, level, timestamp, signature)
    const attestationData = encodeAbiParameters(
      parseAbiParameters("bytes32, string, uint256, bytes"),
      [nullifierHash as Hex, level, timestamp, signature],
    );

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
 * Body: { idkitResult, sourceNode, label }
 * Hash: keccak256(abi.encodePacked("revoke", nullifierHash, sourceNode, label, timestamp))
 * Note: no level — contract revokeLink does not include level in its hash
 */
app.post("/api/verify-and-sign-revoke", async (req, res) => {
  try {
    const { idkitResult, sourceNode, label } = req.body;
    if (!idkitResult || !sourceNode || !label) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const hash = keccak256(
      encodePacked(
        ["string", "bytes32", "bytes32", "string", "uint256"],
        ["revoke", nullifierHash as Hex, sourceNode as Hex, label, timestamp],
      ),
    );
    const signature = await account.signMessage({ message: { raw: hash } });

    res.json({ nullifierHash, timestamp: timestamp.toString(), signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Revoke signing error:", message);
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/verify-and-sign-agent
 * Body: { idkitResult, parentLabel, agentLabel, agentAddress }
 * Hash: keccak256(abi.encodePacked("createAgent", nullifierHash, parentLabel, agentLabel, agentAddress, timestamp))
 */
app.post("/api/verify-and-sign-agent", async (req, res) => {
  try {
    const { idkitResult, parentLabel, agentLabel, agentAddress } = req.body;
    if (!idkitResult || !parentLabel || !agentLabel || !agentAddress) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const hash = keccak256(
      encodePacked(
        ["string", "bytes32", "string", "string", "address", "uint256"],
        [
          "createAgent",
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
 * Body: { idkitResult, parentLabel, agentLabel }
 * Hash: keccak256(abi.encodePacked("revokeAgent", nullifierHash, parentLabel, agentLabel, timestamp))
 */
app.post("/api/verify-and-sign-revoke-agent", async (req, res) => {
  try {
    const { idkitResult, parentLabel, agentLabel } = req.body;
    if (!idkitResult || !parentLabel || !agentLabel) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const { nullifierHash } = await verifyWorldId(idkitResult);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const hash = keccak256(
      encodePacked(
        ["string", "bytes32", "string", "string", "uint256"],
        ["revokeAgent", nullifierHash as Hex, parentLabel, agentLabel, timestamp],
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
