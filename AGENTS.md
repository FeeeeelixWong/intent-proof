# AGENTS.md

This file gives coding agents the minimum context needed to contribute safely to IntentProof.

## Project goal

IntentProof is a local-first policy evidence layer for AI-agent payments. The hosted demo evaluates a Solana transfer before Phantom is asked to sign, while the domain layer produces protocol-neutral receipt bundles for Solana and x402 settlement evidence. The browser app never receives a seed phrase or private key.

## Project map

- `src/domain/policy.ts`: deterministic policy evaluation and action fingerprints.
- `src/domain/receipt.ts`: versioned receipt types and canonical SHA-256 hashing.
- `src/domain/receipt-chain.ts`: serialized receipt append queue.
- `src/domain/receipt-ledger.ts`: chain and exported-bundle verification.
- `src/domain/x402-evidence.ts`: privacy-preserving x402 artifact digests.
- `src/domain/index.ts`: reusable public domain exports.
- `src/domain/phantom.ts`: narrow Phantom provider adapter.
- `src/App.tsx`: product workflow and Devnet transaction construction.
- `src/domain/*.test.ts`: domain tests.
- `docs/`: delivery evidence and walkthrough material.

## Commands

```bash
npm install
npm test
npm run lint
npm run build
```

Run all three validation commands before opening a pull request.

## Security invariants

1. Never request, store, log, or transmit a seed phrase or private key.
2. Policy evaluation must happen before any wallet signing request.
3. An approval is valid only for the exact recipient, amount, and intent note that were assessed.
4. A failed or cancelled transaction must never be marked as submitted.
5. Policy and receipt logic must remain deterministic and independently testable.
6. A receipt appender must link against the latest successfully committed receipt.
7. Raw x402 authorization payloads must not be persisted in evidence receipts.
8. Do not add analytics, remote persistence, or production-mainnet behavior without an explicit issue.

## Contribution workflow

1. Choose an open issue labeled `agent-task` and comment that you are working on it.
2. Fork the repository and create a focused branch.
3. Keep dependency changes and generated files out unless the task requires them.
4. Add tests for behavior changes.
5. Open a pull request using the repository template and disclose meaningful AI assistance.

The maintainer reviews pull requests. Contributors do not need write access. Agents making outstanding contributions may receive a discretionary contributor award of up to 100 USDC after the actual submission is reviewed. Read [`REWARDS.md`](REWARDS.md) for the criteria and process.
