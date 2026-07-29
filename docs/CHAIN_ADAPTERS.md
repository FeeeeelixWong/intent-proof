# Chain Adapter Guide

IntentProof separates evidence integrity from blockchain-specific validation. The receipt and ledger modules never import EVM, Solana, Aptos, or explorer-specific logic. A `ChainRegistry` combines:

- a namespace adapter for address and transaction identifier rules;
- a network manifest for display name, environment, and explorer URL.

Network identifiers follow the x402 `namespace:reference` convention. Built-in identifiers use official x402 values, including `eip155:196`, `eip155:8453`, and `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`.

## Built-in registry

`createDefaultChainRegistry()` includes:

| Network | Identifier | Evidence adapter |
| --- | --- | --- |
| X Layer Mainnet | `eip155:196` | EVM |
| Base Mainnet | `eip155:8453` | EVM |
| Base Sepolia | `eip155:84532` | EVM |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Solana |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Solana |

These entries provide receipt validation and explorer resolution. Only Solana Devnet currently has a wallet-execution flow in the hosted demo.

## Add another EVM network

All EVM networks share the `eip155` adapter. Registering a chain does not require changes to receipt types or verification code:

```ts
const registry = new ChainRegistry()
  .registerAdapter(evmChainAdapter)
  .registerNetwork({
    displayName: 'Example EVM',
    environment: 'testnet',
    explorerTransactionUrl: 'https://explorer.example/tx/{tx}',
    id: 'eip155:999999',
  })
```

## Add a new namespace

Simple address models can use a declarative pattern adapter:

```ts
const aptosAdapter = createPatternChainAdapter({
  addressPattern: /^0x[a-f0-9]{64}$/,
  namespace: 'aptos',
  networkReferencePattern: /^[0-9]+$/,
  transactionPattern: /^0x[a-f0-9]{64}$/,
})

const registry = new ChainRegistry()
  .registerAdapter(aptosAdapter)
  .registerNetwork({
    displayName: 'Aptos Mainnet',
    environment: 'mainnet',
    explorerTransactionUrl: 'https://explorer.aptoslabs.com/txn/{tx}?network=mainnet',
    id: 'aptos:1',
  })
```

Complex chains can implement the small `ChainAdapter` interface directly:

```ts
type ChainAdapter = {
  namespace: string
  normalizeAddress(address: string): string
  validateAddress(address: string): boolean
  validateNetworkReference(reference: string): boolean
  validateTransactionId(transactionId: string): boolean
}
```

## Verification integration

Pass registry validation into both live verification and exported-bundle verification:

```ts
const validator = (receipt: AuditReceipt) =>
  registry.validateReceipt(receipt).map((issue) => issue.message)

await verifyReceiptChain(receipts, [validator])
await verifyReceiptLedgerBundle(bundle, [validator])
```

## Required tests

Every network contribution must prove:

1. valid and invalid addresses are distinguished;
2. x402 asset identifiers are validated using the chain's address rules;
3. valid and invalid transaction identifiers are distinguished;
4. the network identifier parses correctly;
5. explorer URLs are produced only for valid transactions;
6. receipt-chain verification accepts valid evidence and rejects network mismatches;
7. blocked malformed actions remain exportable as evidence of the denied attempt.

Do not claim wallet, facilitator, or mainnet execution support based only on an evidence adapter.
