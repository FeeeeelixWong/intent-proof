# Superteam Agentic Engineering Grant Application

## Project name

IntentProof

## Short description

IntentProof is a local-first control and evidence ledger for AI agents preparing Solana transfers. Before a wallet is asked to sign, it evaluates the agent's proposed action against local recipient, budget, and intent-evidence policies. Every allow or block decision becomes an exportable, SHA-256-linked receipt; approved Devnet transfers also carry the declared intent in a Solana Memo instruction.

## Application copy

I am building **IntentProof**, a local-first safety and audit layer for Solana agents.

Autonomous agents can draft and prepare on-chain actions quickly, but users still need a clear answer to three questions before a wallet signature: what is the agent trying to do, does it comply with a pre-agreed budget and recipient policy, and what evidence remains after the action? IntentProof answers those questions without taking custody of keys.

The MVP is a working React and TypeScript application connected to Solana Devnet. An operator enters an agent transfer intent, recipient, amount, and note. IntentProof applies a local policy engine with an allowlist, per-action limit, daily limit, and required intent note. It records every decision into an SHA-256-linked evidence chain. For approved actions, the user connects Phantom on Devnet and signs a real `SystemProgram.transfer` plus a Memo instruction containing the declared intent. The resulting transaction can be opened in Solana Explorer and the evidence ledger can be exported as JSON.

I will use the grant to cover a month of AI coding tooling while I finish the public demo, polish the installation and Devnet walkthrough, and record a short product walkthrough. The result will be an open-source, reproducible example of a useful agent pattern on Solana: autonomous proposal, local policy enforcement, user-held signing authority, and durable evidence.

## Solana integration

- Solana Devnet RPC connectivity and latest-blockhash health check.
- Phantom wallet connection; keys never leave the wallet extension.
- Real `SystemProgram.transfer` construction only after local policy approval.
- On-chain Memo instruction containing the declared intent.
- Transaction signature linked from the local evidence receipt to Solana Explorer.

## Delivered MVP scope

- [x] Recipient allowlist, per-action budget, daily-budget, and required-note policy checks.
- [x] Hash-linked local evidence receipts for allowed and blocked actions.
- [x] Phantom Devnet signing path for SOL transfer plus Memo.
- [x] JSON evidence export and Solana Explorer transaction links.
- [x] Unit tests, production build, lint, desktop/mobile UI verification.

## Remaining second-tranche deliverables

1. Publish the public repository and hosted demo.
2. Record a concise Devnet walkthrough demonstrating an allow, a block, and a wallet-gated submission.
3. Attach the qualifying AI coding subscription receipt required by the grant program.
4. Submit the live URL, repository URL, and receipt through Superteam Earn's second-tranche form.

## Links to fill after publication

- Repository: `REPOSITORY_URL`
- Live demo: `DEPLOYMENT_URL`
- Demo video: `DEMO_VIDEO_URL`
