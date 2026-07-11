# IntentProof

IntentProof is a local-first guardrail and evidence ledger for AI agents that prepare Solana transfers. It gives a human operator a clear policy decision before their wallet is asked to sign anything.

## What it does

- Evaluates an agent's proposed SOL transfer against a local recipient allowlist, per-action budget, daily budget, and required intent note.
- Builds and signs a real **Solana Devnet** transfer only after the local policy allows it and the operator confirms it in Phantom.
- Adds the declared intent as an on-chain Memo instruction.
- Produces an exportable SHA-256-linked receipt for every allowed or blocked decision in the current browser session.

IntentProof never receives a seed phrase or private key. Wallet signing remains inside the user's Phantom extension.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. To submit a transfer, install Phantom, select **Devnet** in Phantom settings, obtain Devnet SOL from a faucet, and add a valid Devnet recipient to the local allowlist.

## Hosted demo

After GitHub Pages is enabled, the demo is published at `https://feeeelixwong.github.io/intent-proof/`.

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
