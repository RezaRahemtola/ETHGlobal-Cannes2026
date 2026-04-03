# HumanENS

Biometric-bound ENS identities using World ID. Prove you're human on-chain, protect your name from theft, and give your AI agents human-readable identities.

## Problem

1. **ENS names are only as secure as your private key.** Wallet phished = name stolen. No recovery.
2. **No way to distinguish human-owned ENS names from bot-owned ones.** As agents proliferate, proving human ownership becomes critical.
3. **AI agents lack human-readable identity.** AgentKit gives agents a wallet + nullifier hash — but no naming, no discoverability, no visible link to their operator.

## How It Works

### Mode 1: Vault

Transfer your `alice.eth` to the HumanENS contract. Wallet hacked? Re-verify World ID → point name to new wallet. Attacker gets nothing.

### Mode 2: Verified Link

Keep ownership of `alice.eth`, get a verified `alice.humanens.eth` subname linked via bidirectional proof — no transfer required.

### Agent Subnames

Create `shopping-bot.alice.humanens.eth` — a World ID-gated agent namespace where every name traces back to a verified human. Resolvable everywhere ENS works.

## Architecture

```
Frontend (Next.js, IDKit, wagmi/viem)
    │
    ├── Backend (Express) ─── World ID v4 cloud verification + EIP-712 attestations
    │
    ├── Ethereum Mainnet
    │   ├── HumanENSVault.sol ─── lock/unlock/recover names
    │   └── Durin L1 Resolver ─── CCIP-Read resolution for subnames
    │
    └── World Chain Mainnet
        ├── HumanENSLinker.sol ─── register/revoke verified links + agent subnames
        ├── Durin L2 Registry ──── subnames as ERC-721 + records
        └── ENS Ownership Gateway ─ reads L1 ENS state via RPC
```

## Tech Stack

- **Contracts**: Solidity (Durin, NameWrapper, EIP-712, CCIP-Read)
- **Backend**: Express/Node.js
- **Frontend**: Next.js, TypeScript, wagmi/viem, IDKit, MiniKit, ensjs
- **Infra**: World Chain mainnet, Ethereum mainnet, Vercel

## Getting Started

```bash
# TODO
```

## License

MIT
