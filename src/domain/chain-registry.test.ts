import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import {
  ChainRegistry,
  NETWORK_IDS,
  createDefaultChainRegistry,
  createPatternChainAdapter,
  evmChainAdapter,
  parseNetworkId,
} from './chain-registry'
import { createReceipt } from './receipt'
import { verifyReceiptChain } from './receipt-ledger'
import { createX402PaymentEvidence } from './x402-evidence'

const evmAddress = `0x${'ab'.repeat(20)}`
const evmTransaction = `0x${'cd'.repeat(32)}`

describe('chain adapter registry', () => {
  it('parses x402 network identifiers from different namespaces', () => {
    expect(parseNetworkId(NETWORK_IDS.baseMainnet)).toMatchObject({
      namespace: 'eip155',
      reference: '8453',
    })
    expect(parseNetworkId(NETWORK_IDS.solanaDevnet)).toMatchObject({
      namespace: 'solana',
    })
    expect(parseNetworkId('algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=')).toMatchObject({
      namespace: 'algorand',
    })
    expect(parseNetworkId('solana:devnet:extra')).toBeNull()
  })

  it('ships five registered networks across EVM and Solana', () => {
    const registry = createDefaultChainRegistry()

    expect(registry.listNetworks().map((network) => network.id)).toEqual(expect.arrayContaining([
      NETWORK_IDS.baseMainnet,
      NETWORK_IDS.baseSepolia,
      NETWORK_IDS.solanaDevnet,
      NETWORK_IDS.solanaMainnet,
      NETWORK_IDS.xLayerMainnet,
    ]))
  })

  it('builds explorer links only for valid transaction identifiers', () => {
    const registry = createDefaultChainRegistry()
    const solanaSignature = bs58.encode(new Uint8Array(64).fill(7))

    expect(registry.transactionUrl(NETWORK_IDS.xLayerMainnet, evmTransaction)).toBe(
      `https://www.okx.com/web3/explorer/xlayer/tx/${evmTransaction}`,
    )
    expect(registry.transactionUrl(NETWORK_IDS.solanaDevnet, solanaSignature)).toBe(
      `https://explorer.solana.com/tx/${solanaSignature}?cluster=devnet`,
    )
    expect(registry.transactionUrl(NETWORK_IDS.baseMainnet, 'not-a-transaction')).toBeNull()
  })

  it('normalizes addresses through the namespace adapter', () => {
    const registry = createDefaultChainRegistry()
    const mixedCaseAddress = `  0x${'aB'.repeat(20)}  `

    expect(registry.normalizeAddress(NETWORK_IDS.xLayerMainnet, mixedCaseAddress)).toBe(
      `0x${'ab'.repeat(20)}`,
    )
    expect(registry.normalizeAddress('unknown:1', mixedCaseAddress)).toBeNull()
  })

  it('adds a new EVM chain with one network manifest and no core changes', () => {
    const registry = new ChainRegistry()
      .registerAdapter(evmChainAdapter)
      .registerNetwork({
        displayName: 'Example EVM',
        environment: 'testnet',
        explorerTransactionUrl: 'https://explorer.example/tx/{tx}',
        id: 'eip155:999999',
      })

    expect(registry.transactionUrl('eip155:999999', evmTransaction)).toBe(
      `https://explorer.example/tx/${evmTransaction}`,
    )
  })

  it('adds a new namespace through a declarative pattern adapter', async () => {
    const aptosAddress = `0x${'ab'.repeat(32)}`
    const aptosTransaction = `0x${'cd'.repeat(32)}`
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

    expect(registry.listNetworks()).toEqual([
      expect.objectContaining({ id: 'aptos:1' }),
    ])

    const evidence = await createX402PaymentEvidence({
      amount: '10000',
      asset: aptosAddress,
      network: 'aptos:1',
      payTo: aptosAddress,
      paymentRequired: { amount: '10000', network: 'aptos:1' },
      protocolVersion: 2,
      resource: 'https://api.example.com/report',
      scheme: 'exact',
      settlement: {
        success: true,
        transactionHash: aptosTransaction,
      },
    })
    const receipt = await createReceipt({
      action: {
        amount: '10000',
        asset: aptosAddress,
        kind: 'x402-payment',
        network: 'aptos:1',
        payTo: aptosAddress,
        resource: 'https://api.example.com/report',
      },
      agentId: 'aptos-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Aptos payment settled.',
      status: 'settled',
    })

    expect(registry.validateReceipt(receipt)).toEqual([])
  })

  it('rejects malformed namespace references and unsafe explorer templates', () => {
    expect(() => new ChainRegistry()
      .registerAdapter(evmChainAdapter)
      .registerNetwork({
        displayName: 'Invalid EVM',
        environment: 'testnet',
        id: 'eip155:not-a-number',
      })).toThrow('Invalid eip155 network reference')

    expect(() => new ChainRegistry()
      .registerAdapter(evmChainAdapter)
      .registerNetwork({
        displayName: 'Unsafe Explorer',
        environment: 'testnet',
        explorerTransactionUrl: 'http://explorer.example/tx/{tx}',
        id: 'eip155:999999',
      })).toThrow('must use HTTPS')
  })

  it('plugs chain validation into receipt-chain verification', async () => {
    const evidence = await createX402PaymentEvidence({
      amount: '10000',
      asset: evmAddress,
      network: NETWORK_IDS.baseMainnet,
      payTo: evmAddress,
      paymentRequired: { amount: '10000', network: NETWORK_IDS.baseMainnet },
      protocolVersion: 2,
      resource: 'https://api.example.com/report',
      scheme: 'exact',
      settlement: {
        success: true,
        transactionHash: evmTransaction,
      },
    })
    const receipt = await createReceipt({
      action: {
        amount: '10000',
        asset: evmAddress,
        kind: 'x402-payment',
        network: NETWORK_IDS.baseMainnet,
        payTo: evmAddress,
        resource: 'https://api.example.com/report',
      },
      agentId: 'buyer-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Payment settled.',
      status: 'settled',
    })
    const registry = createDefaultChainRegistry()

    await expect(verifyReceiptChain(
      [receipt],
      [(candidate) => registry.validateReceipt(candidate).map((issue) => issue.message)],
    )).resolves.toMatchObject({ issues: [], valid: true })
  })

  it('rejects malformed x402 payment addresses, assets, and transaction identifiers', async () => {
    const evidence = await createX402PaymentEvidence({
      amount: '10000',
      asset: 'USDC',
      network: NETWORK_IDS.baseMainnet,
      payTo: 'merchant.eth',
      paymentRequired: { amount: '10000', network: NETWORK_IDS.baseMainnet },
      protocolVersion: 2,
      resource: 'https://api.example.com/report',
      scheme: 'exact',
      settlement: {
        success: true,
        transactionHash: 'invalid-transaction',
      },
    })
    const receipt = await createReceipt({
      action: {
        amount: '10000',
        asset: 'USDC',
        kind: 'x402-payment',
        network: NETWORK_IDS.baseMainnet,
        payTo: 'merchant.eth',
        resource: 'https://api.example.com/report',
      },
      agentId: 'buyer-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Malformed payment evidence.',
      status: 'settled',
    })
    const issueCodes = createDefaultChainRegistry()
      .validateReceipt(receipt)
      .map((issue) => issue.code)

    expect(issueCodes).toEqual(expect.arrayContaining([
      'invalid_address',
      'invalid_asset',
      'invalid_transaction_id',
    ]))
  })

  it('keeps blocked malformed addresses as valid evidence of a denied attempt', async () => {
    const receipt = await createReceipt({
      action: {
        amountLamports: '10000000',
        intentNote: 'Blocked invalid recipient',
        network: NETWORK_IDS.solanaDevnet,
        recipient: '',
      },
      agentId: 'audit-agent.local',
      decision: 'BLOCK',
      previousHash: null,
      reason: 'Recipient allowlist',
      status: 'blocked',
    })
    const registry = createDefaultChainRegistry()

    expect(registry.validateReceipt(receipt)).toEqual([])
  })
})
