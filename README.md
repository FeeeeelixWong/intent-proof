# IntentProof

[![CI](https://github.com/FeeeeelixWong/intent-proof/actions/workflows/ci.yml/badge.svg)](https://github.com/FeeeeelixWong/intent-proof/actions/workflows/ci.yml)
[![AI agents welcome](https://img.shields.io/badge/AI_agents-welcome-0b7285)](AGENTS.md)
[![Contributor awards](https://img.shields.io/badge/contributor_awards-up_to_100_USDC-2f9e44)](REWARDS.md)
[![Good first issues](https://img.shields.io/github/issues/FeeeeelixWong/intent-proof/good%20first%20issue?label=good%20first%20issues)](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

IntentProof is a local-first policy evidence layer for AI-agent payments. It records what an agent intended, what policy decided, and what ultimately settled in a portable, independently verifiable receipt chain.

The hosted product is a working Solana Devnet demonstration. The domain layer also includes a protocol-neutral receipt schema, an x402 evidence adapter, and a chain-adapter registry for the broader AgentPay control plane.

**[Try the demo](https://feeeeelixwong.github.io/intent-proof/)** |
**[Find an agent-ready task](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22agent-task%22)** |
**[Contributor awards](REWARDS.md)** |
**[Read the agent guide](AGENTS.md)** |
**[Contribute](CONTRIBUTING.md)**

## What it does

- Evaluates an agent's proposed SOL transfer against a local recipient allowlist, per-action budget, daily budget, and required intent note.
- Parses SOL input once into canonical lamports and reuses that exact integer for policy checks, approval fingerprints, receipts, daily accounting, and the Devnet transaction.
- Binds each approval to the exact recipient, amount, and intent note that was assessed; editing any of them requires another policy decision.
- Builds and signs a real **Solana Devnet** transfer only after the local policy allows it and the operator confirms it in Phantom.
- Adds the declared intent as an on-chain Memo instruction.
- Serializes concurrent receipt creation so every event links to one committed predecessor.
- Produces versioned, canonical SHA-256 receipts for allowed, blocked, submitted, failed, or settled events.
- Verifies every receipt hash and link before exporting a portable `intentproof.receipt-ledger.v1` bundle.
- Creates x402 evidence from `PAYMENT-REQUIRED`, payment payload, facilitator, and settlement artifacts without storing the raw authorization payload.
- Resolves network validation and explorer links through pluggable namespace adapters instead of hard-coded chain branches.

IntentProof never receives a seed phrase or private key. Wallet signing remains inside the user's Phantom extension.

SOL amounts are accepted as strict decimal strings with at most nine fractional digits. Scientific notation, zero/negative values, surrounding whitespace, and values outside the safe transaction range are rejected. Serialized Solana actions store the exact lamport amount as a decimal string; SOL formatting is display-only.

## Product boundary

| Layer | IntentProof responsibility |
| --- | --- |
| Policy engine | Supplies the decision and reason recorded in a receipt |
| Wallet | Retains keys and signs the approved action |
| Facilitator | Verifies and settles an x402 payment |
| Chain Registry | Validates network, address, and transaction identifiers through adapters |
| IntentProof | Binds intent, policy, payment digests, settlement reference, and the previous receipt hash |
| Unified Console | Imports and presents verified ledger bundles |

IntentProof does not route payments, custody assets, or act as a facilitator.

## Network support

| Support level | Networks |
| --- | --- |
| End-to-end wallet execution | Solana Devnet |
| Built-in evidence validation | X Layer Mainnet, Base Mainnet, Base Sepolia, Solana Mainnet, Solana Devnet |
| Fast expansion | Any EVM network through one network manifest |
| New chain family | One namespace adapter plus one network manifest |

Evidence validation means IntentProof can validate and link a normalized settlement receipt. It does not mean the IntentProof demo can initiate a payment on that network.

## Part of an Agent Trust Stack

IntentProof records what happened after a sensitive action. It complements [Audit Skill Supply Chain](https://github.com/FeeeeelixWong/audit-skill-supply-chain), which reviews a skill before installation, and [AgentSpend Guard](https://github.com/FeeeeelixWong/agent-spend-guard), which enforces a spending policy before payment.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. To submit a transfer, install Phantom, select **Devnet** in Phantom settings, obtain Devnet SOL from a faucet, and add a valid Devnet recipient to the local allowlist.

## Hosted demo

After GitHub Pages is enabled, the demo is published at `https://feeeeelixwong.github.io/intent-proof/`.

The delivery walkthrough video is published at `https://feeeeelixwong.github.io/intent-proof/delivery/intentproof-devnet-policy-demo.mp4`.

The grant delivery evidence, release, CI run, and reproduction steps are collected in
[`docs/FINAL_TRANCHE.md`](docs/FINAL_TRANCHE.md).

## Contribute with an AI agent

Humans and coding agents are both welcome. Start with an open
[`agent-task`](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22agent-task%22),
comment to claim it, and submit a focused pull request.

- [`AGENTS.md`](AGENTS.md) gives coding agents the project map, commands, and security invariants.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) explains the fork, test, and pull request workflow.
- [`REWARDS.md`](REWARDS.md) explains the post-submission review for discretionary contributor awards of up to 100 USDC.
- Accepted contributors are credited in release notes, and outstanding agent contributions may also receive a contributor award after review.

## Validation

```bash
npm test
npm run build
```

## Architecture

```text
Agent intent
    |
    v
Policy decision ---------> blocked receipt
    |
    v
Wallet authorization
    |
    v
Chain or x402 facilitator
    |
    v
Settlement evidence
    |
    v
Serialized receipt appender
    |
    v
Chain adapter validation
    |
    v
Verified ledger bundle ---------> Unified Console
```

The current browser demo follows the Solana path: Phantom signs a `SystemProgram.transfer` plus a Memo instruction on Devnet. The reusable domain layer follows the same receipt flow for x402 payments.

## x402 integration

`createX402PaymentEvidence` hashes payment artifacts using canonical JSON. Raw payment authorizations are not copied into the receipt:

```ts
import {
  createReceipt,
  createX402PaymentEvidence,
  verifyReceiptChain,
} from './src/domain'

const evidence = await createX402PaymentEvidence({
  amount: '10000',
  asset: '0xUSDC',
  network: 'eip155:8453',
  payTo: '0xMerchant',
  paymentPayload,
  paymentRequired,
  protocolVersion: 2,
  resource: 'https://api.example.com/report',
  scheme: 'exact',
  settlement: {
    response: settlementResponse,
    success: true,
    transactionHash: '0x...',
  },
})
```

See [`docs/RECEIPT_SCHEMA.md`](docs/RECEIPT_SCHEMA.md) for the complete schema, verification rules, and Router/Console integration contract.

## Add a network

An additional EVM chain reuses the built-in `eip155` adapter:

```ts
import { ChainRegistry, evmChainAdapter } from './src/domain'

const registry = new ChainRegistry()
  .registerAdapter(evmChainAdapter)
  .registerNetwork({
    displayName: 'Example EVM',
    environment: 'testnet',
    explorerTransactionUrl: 'https://explorer.example/tx/{tx}',
    id: 'eip155:999999',
  })
```

A new chain family uses `createPatternChainAdapter`; receipt hashing, ledger export, and UI code remain unchanged. See [`docs/CHAIN_ADAPTERS.md`](docs/CHAIN_ADAPTERS.md) for the complete extension contract.

## Grant fit

This project began as a working Solana product for the Superteam Agentic Engineering Grant. It now preserves that delivery while evolving the receipt core into reusable infrastructure for agent-payment policy, x402 settlement, and audit products.

## License

MIT. See [`LICENSE`](LICENSE).
