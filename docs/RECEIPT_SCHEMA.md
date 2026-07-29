# IntentProof Receipt Schema

IntentProof exports a portable evidence bundle that can be verified without trusting the browser session, facilitator, or future Unified Console that displays it.

## Schemas

| Object | Schema identifier |
| --- | --- |
| Receipt | `intentproof.audit-receipt.v1` |
| Ledger bundle | `intentproof.receipt-ledger.v1` |

Hashes are lowercase hexadecimal SHA-256 digests. Receipt objects are normalized recursively with lexicographically sorted object keys before hashing. Arrays retain their original order, undefined object properties are omitted, and monetary integers should be encoded as decimal strings.

## Receipt fields

| Field | Purpose |
| --- | --- |
| `schema` | Versioned receipt contract |
| `id` | Unique event identifier |
| `timestamp` | Event creation time |
| `agentId` | Agent or delegated actor |
| `action` | Solana transfer or protocol-neutral x402 action |
| `decision` | `ALLOW`, `BLOCK`, `DENY`, or `HOLD` |
| `reason` | Human-readable policy or settlement reason |
| `status` | `approved`, `blocked`, `submitted`, `settled`, or `failed` |
| `evidence` | Chain transaction or x402 artifact references |
| `previousHash` | Hash of the immediately preceding committed receipt |
| `hash` | SHA-256 digest of every other receipt field |

## x402 evidence

An x402 receipt may bind:

- protocol version, scheme, CAIP-2 network, asset, amount, resource, and `payTo`;
- facilitator identifier and public endpoint;
- SHA-256 digests of `PAYMENT-REQUIRED`, payment payload, and settlement response;
- settlement success, transaction hash, and settlement time.

IntentProof stores digests instead of raw payment authorizations. This prevents an exported ledger from becoming a reusable authorization-bearing artifact while still allowing a party that possesses the original message to prove that it matches the receipt.

## Verification

`verifyReceiptChain` checks:

1. every receipt uses the supported schema;
2. every receipt links to its immediate predecessor;
3. ids and hashes are not duplicated;
4. every claimed hash matches the canonical receipt content;
5. action fields match the attached chain or x402 evidence and settlement status.

`verifyReceiptLedgerBundle` additionally checks the ledger schema, hash algorithm, receipt count, genesis hash, and tip hash.

Changing a decision, reason, amount, address, evidence digest, transaction reference, or previous hash invalidates verification.

## Integration flow

```text
402 challenge
    |
    v
Pre-sign policy decision
    |
    v
Wallet authorization
    |
    v
Facilitator verify / settle
    |
    v
createX402PaymentEvidence
    |
    v
createReceiptAppender
    |
    v
createReceiptLedgerBundle
    |
    v
Unified Console verifies before display
```

The Router should provide normalized facilitator metadata and settlement results. IntentProof should remain unaware of API credentials and should never receive wallet private keys.
