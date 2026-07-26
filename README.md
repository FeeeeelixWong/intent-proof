# IntentProof

[![CI](https://github.com/FeeeeelixWong/intent-proof/actions/workflows/ci.yml/badge.svg)](https://github.com/FeeeeelixWong/intent-proof/actions/workflows/ci.yml)
[![AI agents welcome](https://img.shields.io/badge/AI_agents-welcome-0b7285)](AGENTS.md)
[![Contributor awards](https://img.shields.io/badge/contributor_awards-up_to_100_USDC-2f9e44)](REWARDS.md)
[![Good first issues](https://img.shields.io/github/issues/FeeeeelixWong/intent-proof/good%20first%20issue?label=good%20first%20issues)](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

IntentProof is a local-first guardrail and evidence ledger for AI agents that prepare Solana transfers. It gives a human operator a clear policy decision before their wallet is asked to sign anything.

**[Try the demo](https://feeeeelixwong.github.io/intent-proof/)** |
**[Find an agent-ready task](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22agent-task%22)** |
**[Contributor awards](REWARDS.md)** |
**[Read the agent guide](AGENTS.md)** |
**[Contribute](CONTRIBUTING.md)**

## What it does

- Evaluates an agent's proposed SOL transfer against a local recipient allowlist, per-action budget, daily budget, and required intent note.
- Binds each approval to the exact recipient, amount, and intent note that was assessed; editing any of them requires another policy decision.
- Builds and signs a real **Solana Devnet** transfer only after the local policy allows it and the operator confirms it in Phantom.
- Adds the declared intent as an on-chain Memo instruction.
- Produces an exportable SHA-256-linked receipt for every allowed or blocked decision in the current browser session.

IntentProof never receives a seed phrase or private key. Wallet signing remains inside the user's Phantom extension.

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

1. The operator enters an agent identity, recipient, amount, and intent note.
2. The local policy engine blocks or allows the action before a wallet connection is needed.
3. A receipt is recorded locally with the previous receipt hash.
4. For allowed actions, Phantom signs a `SystemProgram.transfer` plus a Memo instruction on Solana Devnet.
5. The confirmed transaction signature is appended to a submitted receipt and can be opened in Solana Explorer.

## Grant fit

This project is a working Solana product for the Superteam Agentic Engineering Grant. It demonstrates an agent-native pattern: agents can propose actions, while users retain custody and receive a verifiable, human-readable trail of every decision and transaction.

## License

MIT. See [`LICENSE`](LICENSE).
