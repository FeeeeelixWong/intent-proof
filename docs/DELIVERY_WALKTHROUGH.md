# IntentProof Delivery Walkthrough

## Delivery video

https://feeeeelixwong.github.io/intent-proof/delivery/intentproof-devnet-policy-demo.mp4

## Purpose

IntentProof is a local-first control and evidence layer for an AI agent that
prepares a Solana transfer. The operator reviews a policy decision before a
wallet is asked to sign, and every decision is retained in a hash-linked local
receipt chain.

## Reproduce the policy flow

1. Open the hosted demo at https://feeeeelixwong.github.io/intent-proof/.
2. Select the refresh icon to load the deliberately blocked example, then
   choose **Assess action**. The recipient allowlist and per-action budget
   checks block the action and create a receipt.
3. Enter a valid Devnet recipient public key, choose **Allow**, set an amount
   at or below `0.050 SOL`, and retain a clear intent note. Choose **Assess
   action** again. The local policy returns `ALLOW` and appends a second,
   hash-linked receipt.
4. The approval is bound to that exact recipient, amount, and intent note. If
   any of those fields changes, IntentProof requires a fresh assessment before
   it can request a wallet signature.
5. Connect Phantom with its network set to **Devnet**. The app never receives
   a seed phrase or private key.
6. Choose **Approve & send on Devnet** and inspect the Phantom transaction
   before approving it. The transaction contains the SOL transfer and an
   IntentProof Memo instruction. On confirmation, the transaction signature is
   stored with the submitted receipt and linked to Solana Explorer.
7. Use **Export all receipt JSON** to retain the local audit evidence.

## Verification status

- The hosted UI, Devnet blockhash health check, blocked decision, allowed
  decision, receipt chaining, and wallet gate were exercised in a real browser
  on 2026-07-11.
- The repository includes `scripts/verify-devnet-transfer.mjs`, which creates
  an ephemeral test signer and sends a transfer plus Memo through the public
  Devnet RPC. No private key is written to disk.
- The public Devnet faucet returned a rate-limit response during the delivery
  run. The final on-chain signature must therefore be made with an operator's
  funded Devnet Phantom wallet. This is intentionally a user-controlled step,
  not an automated substitute.

## Delivery video narration

> IntentProof lets an agent prepare a Solana transfer without bypassing the
> operator. First, a deliberately unsafe request is blocked by local rules.
> After the recipient is approved and the budget and intent checks pass, the
> action receives a local allow decision. Every decision becomes a
> SHA-256-linked evidence receipt. At the signing boundary, the application
> stops and asks the operator to connect Phantom on Devnet. Only the wallet
> holder can approve the transaction; IntentProof never holds private keys.
