# Changelog

## 0.1.0 - 2026-07-13

### Delivered

- Local recipient, per-action budget, daily budget, and intent-note controls
  for agent-proposed SOL transfers.
- Hash-linked local evidence receipts with JSON export.
- Phantom-gated Solana Devnet transfers with an on-chain Memo instruction.
- Public GitHub Pages demo and a reproducible delivery walkthrough.

### Security

- An approval is now bound to the exact recipient, amount, and intent note that
  the operator assessed. Editing any of them disables submission until the
  action is assessed again.
- A confirmed Devnet transaction invalidates its local approval, preventing it
  from being reused for another send.
- Private keys and seed phrases remain exclusively in Phantom.

### Verification

- Unit tests cover policy decisions, approval binding, receipt chaining, and
  Phantom provider fallback behavior.
- Lint and production build pass in CI before deployment.
