# Agentic Engineering Grant Final Tranche Evidence

## Public delivery

- Live project: https://feeeeelixwong.github.io/intent-proof/
- Source repository: https://github.com/FeeeeelixWong/intent-proof
- Release: https://github.com/FeeeeelixWong/intent-proof/releases/tag/v0.1.0
- Delivery walkthrough: https://feeeeelixwong.github.io/intent-proof/delivery/intentproof-devnet-policy-demo.mp4
- Successful deployment: https://github.com/FeeeeelixWong/intent-proof/actions/runs/29260564480

## Delivered scope

- Deterministic recipient allowlist, per-action limit, daily limit, and required-intent checks.
- Approval binding to the exact recipient, amount, and intent that was assessed.
- SHA-256-linked receipts for allowed and blocked actions, with JSON export.
- Phantom-controlled Solana Devnet signing; the application never receives a private key.
- A `SystemProgram.transfer` and Memo instruction are assembled only after policy approval.
- Submitted receipts link confirmed signatures to Solana Explorer.
- Responsive hosted interface, automated tests, production build, and GitHub Pages deployment.

## Reproduction

```bash
git clone https://github.com/FeeeeelixWong/intent-proof.git
cd intent-proof
npm install
npm test -- --run
npm run build
npm run dev
```

For the wallet-gated path, use Phantom on Solana Devnet with a funded test wallet. Add the intended
recipient to the local allowlist, assess the transfer, connect Phantom, and confirm the transaction
inside the wallet. No seed phrase or private key should ever be entered into IntentProof.

## Verification snapshot

On July 18, 2026, all 8 automated tests passed, the production build completed successfully, and
the live application and delivery video returned HTTP 200. The tagged `v0.1.0` release and successful
GitHub Pages workflow provide timestamped public delivery evidence.

The qualifying AI subscription receipts and payout wallet are supplied privately through the
Superteam Earn final-tranche form. They are intentionally not committed to this public repository.
