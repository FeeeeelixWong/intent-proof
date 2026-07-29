import bs58 from 'bs58'
import {
  isX402PaymentAction,
  type AuditReceipt,
} from './receipt'

export const NETWORK_IDS = {
  baseMainnet: 'eip155:8453',
  baseSepolia: 'eip155:84532',
  solanaDevnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  solanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  xLayerMainnet: 'eip155:196',
} as const

export type NetworkEnvironment = 'devnet' | 'mainnet' | 'testnet'

export type ChainNetworkDefinition = {
  displayName: string
  environment: NetworkEnvironment
  explorerTransactionUrl?: string
  id: string
}

export type ParsedNetworkId = {
  id: string
  namespace: string
  reference: string
}

export type ChainAdapter = {
  namespace: string
  normalizeAddress: (address: string) => string
  validateAddress: (address: string) => boolean
  validateNetworkReference: (reference: string) => boolean
  validateTransactionId: (transactionId: string) => boolean
}

export type PatternChainAdapterDefinition = {
  addressPattern: RegExp
  namespace: string
  networkReferencePattern: RegExp
  normalizeAddress?: (address: string) => string
  transactionPattern: RegExp
}

export type ChainRegistryIssue = {
  code:
    | 'invalid_address'
    | 'invalid_asset'
    | 'invalid_network'
    | 'invalid_transaction_id'
    | 'network_mismatch'
    | 'unsupported_namespace'
    | 'unregistered_network'
  message: string
}

const networkNamespacePattern = /^[-a-z0-9]{3,8}$/
const networkReferencePattern = /^[^\s:]{1,128}$/

export function parseNetworkId(networkId: string): ParsedNetworkId | null {
  const separator = networkId.indexOf(':')
  if (separator < 0 || separator !== networkId.lastIndexOf(':')) return null

  const namespace = networkId.slice(0, separator)
  const reference = networkId.slice(separator + 1)
  if (!networkNamespacePattern.test(namespace) || !networkReferencePattern.test(reference)) {
    return null
  }

  return {
    id: networkId,
    namespace,
    reference,
  }
}

export function createPatternChainAdapter(
  definition: PatternChainAdapterDefinition,
): ChainAdapter {
  if (!networkNamespacePattern.test(definition.namespace)) {
    throw new TypeError(`Invalid chain namespace: ${definition.namespace}`)
  }
  if (
    definition.addressPattern.global
    || definition.addressPattern.sticky
    || definition.networkReferencePattern.global
    || definition.networkReferencePattern.sticky
    || definition.transactionPattern.global
    || definition.transactionPattern.sticky
  ) {
    throw new TypeError('Adapter validation patterns cannot use global or sticky flags.')
  }

  return {
    namespace: definition.namespace,
    normalizeAddress: definition.normalizeAddress ?? ((address) => address.trim()),
    validateAddress: (address) => definition.addressPattern.test(address.trim()),
    validateNetworkReference: (reference) => definition.networkReferencePattern.test(reference),
    validateTransactionId: (transactionId) => definition.transactionPattern.test(transactionId.trim()),
  }
}

export const evmChainAdapter = createPatternChainAdapter({
  addressPattern: /^0x[a-fA-F0-9]{40}$/,
  namespace: 'eip155',
  networkReferencePattern: /^[1-9][0-9]*$/,
  normalizeAddress: (address) => address.trim().toLowerCase(),
  transactionPattern: /^0x[a-fA-F0-9]{64}$/,
})

export const solanaChainAdapter: ChainAdapter = {
  namespace: 'solana',
  normalizeAddress: (address) => address.trim(),
  validateAddress: (address) => {
    try {
      return bs58.decode(address.trim()).length === 32
    } catch {
      return false
    }
  },
  validateNetworkReference: (reference) => {
    try {
      return reference.length === 32 && bs58.decode(reference).length > 0
    } catch {
      return false
    }
  },
  validateTransactionId: (transactionId) => {
    try {
      return bs58.decode(transactionId.trim()).length === 64
    } catch {
      return false
    }
  },
}

export class ChainRegistry {
  private readonly adapters = new Map<string, ChainAdapter>()
  private readonly networks = new Map<string, ChainNetworkDefinition>()

  registerAdapter(adapter: ChainAdapter): this {
    if (!networkNamespacePattern.test(adapter.namespace)) {
      throw new TypeError(`Invalid chain namespace: ${adapter.namespace}`)
    }
    if (this.adapters.has(adapter.namespace)) {
      throw new Error(`Adapter already registered for namespace ${adapter.namespace}.`)
    }
    this.adapters.set(adapter.namespace, adapter)
    return this
  }

  registerNetwork(network: ChainNetworkDefinition): this {
    const parsed = parseNetworkId(network.id)
    if (!parsed) {
      throw new TypeError(`Invalid network identifier: ${network.id}`)
    }
    if (!this.adapters.has(parsed.namespace)) {
      throw new Error(`Register the ${parsed.namespace} adapter before its networks.`)
    }
    const adapter = this.adapters.get(parsed.namespace)
    if (!adapter?.validateNetworkReference(parsed.reference)) {
      throw new TypeError(`Invalid ${parsed.namespace} network reference: ${parsed.reference}`)
    }
    if (this.networks.has(network.id)) {
      throw new Error(`Network already registered: ${network.id}`)
    }
    if (
      network.explorerTransactionUrl
      && network.explorerTransactionUrl.split('{tx}').length !== 2
    ) {
      throw new TypeError('Explorer transaction URL must contain exactly one {tx} placeholder.')
    }
    if (network.explorerTransactionUrl) {
      const exampleUrl = new URL(network.explorerTransactionUrl.replace('{tx}', 'transaction'))
      if (exampleUrl.protocol !== 'https:') {
        throw new TypeError('Explorer transaction URL must use HTTPS.')
      }
    }

    this.networks.set(network.id, { ...network })
    return this
  }

  getNetwork(networkId: string): ChainNetworkDefinition | undefined {
    const network = this.networks.get(networkId)
    return network ? { ...network } : undefined
  }

  listNetworks(): ChainNetworkDefinition[] {
    return [...this.networks.values()]
      .map((network) => ({ ...network }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
  }

  normalizeAddress(networkId: string, address: string): string | null {
    const parsed = parseNetworkId(networkId)
    const adapter = parsed ? this.adapters.get(parsed.namespace) : undefined
    return adapter ? adapter.normalizeAddress(address) : null
  }

  transactionUrl(networkId: string, transactionId: string): string | null {
    const parsed = parseNetworkId(networkId)
    const network = this.networks.get(networkId)
    const adapter = parsed ? this.adapters.get(parsed.namespace) : undefined
    if (
      !network?.explorerTransactionUrl
      || !adapter?.validateTransactionId(transactionId)
    ) {
      return null
    }
    return network.explorerTransactionUrl.replace('{tx}', transactionId.trim())
  }

  validateReceipt(receipt: AuditReceipt): ChainRegistryIssue[] {
    const issues: ChainRegistryIssue[] = []
    const action = receipt.action
    const networkId = action.network
    const parsed = parseNetworkId(networkId)

    if (!parsed) {
      return [{
        code: 'invalid_network',
        message: `Receipt uses an invalid network identifier: ${networkId}`,
      }]
    }

    const adapter = this.adapters.get(parsed.namespace)
    if (!adapter) {
      return [{
        code: 'unsupported_namespace',
        message: `No adapter is registered for ${parsed.namespace}.`,
      }]
    }

    if (!this.networks.has(networkId)) {
      issues.push({
        code: 'unregistered_network',
        message: `Network ${networkId} is not registered.`,
      })
    }

    const address = isX402PaymentAction(action) ? action.payTo : action.recipient
    const normalizedAddress = adapter.normalizeAddress(address)
    if (receipt.status !== 'blocked' && !adapter.validateAddress(normalizedAddress)) {
      issues.push({
        code: 'invalid_address',
        message: `Address is invalid for ${parsed.namespace}.`,
      })
    }

    if (isX402PaymentAction(action)) {
      const normalizedAsset = adapter.normalizeAddress(action.asset)
      if (!adapter.validateAddress(normalizedAsset)) {
        issues.push({
          code: 'invalid_asset',
          message: `Asset identifier is invalid for ${parsed.namespace}.`,
        })
      }
    }

    if (receipt.evidence && receipt.evidence.network !== networkId) {
      issues.push({
        code: 'network_mismatch',
        message: 'Receipt evidence network does not match the action network.',
      })
    }

    const transactionId = receipt.evidence?.kind === 'x402-payment'
      ? receipt.evidence.settlement?.transactionHash
      : receipt.evidence?.transactionSignature
    if (transactionId && !adapter.validateTransactionId(transactionId)) {
      issues.push({
        code: 'invalid_transaction_id',
        message: `Transaction identifier is invalid for ${parsed.namespace}.`,
      })
    }

    return issues
  }
}

export function createDefaultChainRegistry(): ChainRegistry {
  return new ChainRegistry()
    .registerAdapter(evmChainAdapter)
    .registerAdapter(solanaChainAdapter)
    .registerNetwork({
      displayName: 'Base Mainnet',
      environment: 'mainnet',
      explorerTransactionUrl: 'https://basescan.org/tx/{tx}',
      id: NETWORK_IDS.baseMainnet,
    })
    .registerNetwork({
      displayName: 'Base Sepolia',
      environment: 'testnet',
      explorerTransactionUrl: 'https://sepolia.basescan.org/tx/{tx}',
      id: NETWORK_IDS.baseSepolia,
    })
    .registerNetwork({
      displayName: 'Solana Devnet',
      environment: 'devnet',
      explorerTransactionUrl: 'https://explorer.solana.com/tx/{tx}?cluster=devnet',
      id: NETWORK_IDS.solanaDevnet,
    })
    .registerNetwork({
      displayName: 'Solana Mainnet',
      environment: 'mainnet',
      explorerTransactionUrl: 'https://explorer.solana.com/tx/{tx}',
      id: NETWORK_IDS.solanaMainnet,
    })
    .registerNetwork({
      displayName: 'X Layer Mainnet',
      environment: 'mainnet',
      explorerTransactionUrl: 'https://www.okx.com/web3/explorer/xlayer/tx/{tx}',
      id: NETWORK_IDS.xLayerMainnet,
    })
}

export const defaultChainRegistry = createDefaultChainRegistry()
export const validateReceiptWithDefaultRegistry = (receipt: AuditReceipt): string[] => (
  defaultChainRegistry.validateReceipt(receipt).map((issue) => issue.message)
)
