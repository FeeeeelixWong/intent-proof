# Superteam Agentic Engineering Grant: Codex Response

## Solana.new / Codex prompt

The grant's requested prompt was processed in this Codex session after the
Solana.new Superstack skills were installed:

> help me apply for the agentic engineering grant by Superteam

This is a grant-specific response file, not a raw chat backup. It intentionally
omits unrelated conversation history, personal contact details, wallet data,
and credentials while retaining the prompt, product plan, public evidence, and
delivery boundary that a reviewer can verify.

## Prompt context

This response documents the work produced in a Codex session for the Superteam
Agentic Engineering Grant application.

## Project

**IntentProof** is a local-first policy and evidence ledger for Solana agents.
It lets an agent prepare a transfer while the user retains signing authority and
receives an exportable audit receipt for every allow or block decision.

## Problem

Solana agents can construct transactions faster than an operator can inspect
them. Before a wallet signature, an operator needs to know what the agent is
requesting, whether the request complies with a pre-agreed policy, and what
evidence will remain after the decision. Existing wallet confirmation screens
do not provide a local policy decision trail for the agent's stated intent.

## Proposed solution

IntentProof evaluates a proposed SOL transfer locally against:

- a recipient allowlist;
- a per-action budget;
- a daily budget; and
- a required intent note.

Every decision is appended to an SHA-256-linked receipt chain that can be
exported as JSON. If the request is allowed, the operator can connect Phantom
on Solana Devnet and independently sign a `SystemProgram.transfer` together
with a Memo instruction containing the declared intent. The application never
receives a seed phrase or private key.

## Public evidence

- Live demo: https://feeeeelixwong.github.io/intent-proof/
- Source code: https://github.com/FeeeeelixWong/intent-proof
- Deployment workflow: https://github.com/FeeeeelixWong/intent-proof/actions

The public repository includes the React and TypeScript implementation, unit
tests for the policy engine, lint and production-build configuration, and a
Devnet setup walkthrough. The live application shows local policy evaluation,
hash-linked receipts, JSON export, and the Phantom-gated signing path.

## Delivery plan

Target date: **2026-07-18 (Asia/Shanghai)**.

1. Release the public MVP and validate its build, lint, tests, deployment, and
   desktop/mobile UI. Completed.
2. Publish a concise Devnet walkthrough that demonstrates an allowed request,
   a blocked request, receipt export, and the user-operated signing step.
3. Publish release notes describing the policy model, the non-custodial signing
   boundary, and how developers can reproduce the flow locally.

An on-chain transfer remains deliberately user-operated: it requires the
applicant's Phantom wallet on Devnet and explicit wallet confirmation. This is
the intended security boundary, not an automated claim of a signed transaction.
