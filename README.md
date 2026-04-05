# HumanENS

<img width="2178" height="1976" alt="image" src="https://github.com/user-attachments/assets/e7e8b5dc-b66b-4fc3-81be-b14c888e8ad9" />

## Problem

1. **No way to prove an ENS name belongs to a real human.** Anyone can register a name — there's no on-chain signal distinguishing humans from bots. As AI agents proliferate, this distinction becomes critical.
2. **AI agents have no human-readable identity.** An agent might have a wallet, but no name, no discoverability, and no visible link to its human operator.
3. **No trust anchor for agent namespaces.** You can create ENS subnames, but nothing ties them back to a verified human — so there's no way to know who's behind an agent.

## How It Works

### Verified Link

Keep ownership of your `alice.eth`, get a verified `alice.humanens.eth` subname linked via bidirectional proof — no transfer required. Uses CCIP-Read (EIP-3668) for trustless L1→L2 ownership verification without bridging.

### Agent Subnames

Create `shopping-bot.alice.humanens.eth` — a World ID-gated agent namespace where every name traces back to a verified human. Resolvable everywhere ENS works, compatible with ENSIP-25 (for ERC-8004 agents bidirectional attestation) and with World's AgentBook to benefit from human-only privileges.

## Architecture

```
Frontend (Next.js, IDKit, MiniKit, wagmi/viem)
    │
    ├── Backend (Express) ─── World ID v4 cloud verification + EIP-712 attestations (temporary while v4 contracts are not on mainnet)
    │
    ├── Gateway (Express) ─── CCIP-Read L1 ENS ownership proofs
    │
    └── World Chain Mainnet
        ├── ENS L2Registry ──── handles subnames
        └── HumanENSLinker.sol ─── acts as a custom L2Registrar to register/revoke verified links & agent subnames
```

### Registration Flow

```
1. User enters their ENS label (e.g. "alice")
2. Frontend checks if alice.eth already has a `humanens` text record set on L1 with a nullifier
   └── If missing, user must first set it by following the steps or using the ENS app
3. User switches to the World App & verifies their humanity again with World ID v4
4. Frontend sends the World ID proof to the backend
   └── Backend verifies the proof, signs an EIP-712 attestation (nullifier + label + timestamp)
5. Frontend orchestrates CCIP-Read (EIP-3668):
   └── Calls the gateway with the source ENS node
   └── Gateway reads alice.eth owner + text record from L1 via RPC
   └── Gateway returns a signed ownership proof
6. Frontend sends a transaction via MiniKit in the World App
   └── Contract verifies the backend signature (humanity proof)
   └── Contract verifies the gateway signature (L1 ownership proof)
   └── Contract checks freshness (10-min window) and one-link-per-nullifier
   └── L2 Registry mints alice.humanens.eth on World Chain
```

### Agent Creation Flow

```
1. User enters an agent name (e.g. "shopping-bot") under their verified alice.humanens.eth
2. User verifies with World ID v4 (proves they own the parent link)
3. Frontend sends the proof to the backend
   └── Backend verifies and signs an EIP-712 attestation for agent creation
4. Frontend sends a transaction via MiniKit
   └── Contract verifies signature + nullifier matches parent link owner
   └── L2 Registry mints shopping-bot.alice.humanens.eth as an ERC-721
5. (Optional) User sets an ENSIP-25 text record to link it to an ERC-8004 agent they might already have
```

## Project Structure

```
contracts/          Solidity — HumanENSLinker + Durin integration
backend/            Express — World ID verification + EIP-712 attestation signing
gateway/            Express — CCIP-Read ENS ownership gateway
frontend/           Next.js 15 — World Mini App + browser UI
register-agent/     CLI — ERC-8004 agent registration test script
```

## Live Services

| Service                 | URL                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| World ID Backend        | https://humanens-backend.reza.dev                                                                                      |
| ENS Ownership Gateway   | https://humanens-gateway.reza.dev                                                                                      |
| L2Registry contract     | [0x37119ac61eb66d2b877e8c3fa65924a3b6c6970b](https://worldscan.org/address/0x37119ac61eb66d2b877e8c3fa65924a3b6c6970b) |
| HumanENSLinker contract | [0xE073cc7E0675a65BD9b03D528c1c227614119063](https://worldscan.org/address/0xE073cc7E0675a65BD9b03D528c1c227614119063) |

<div align="center">
  <h2>Made with ❤️ by</h2>
  <a href="https://github.com/RezaRahemtola">
    <img src="https://github.com/RezaRahemtola.png" width=100/>
    <br>
    <span>Reza Rahemtola</span>
  </a>
</div>
