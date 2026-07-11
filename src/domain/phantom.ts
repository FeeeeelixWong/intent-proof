import bs58 from 'bs58'

export interface SolanaWalletProvider {
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>
  isPhantom?: boolean
  request?: (args: {
    method: string
    params: { message: string }
  }) => Promise<{ signature: string }>
  signAndSendTransaction: (transaction: unknown) => Promise<{ signature: string }>
}

export interface PhantomHost {
  phantom?: {
    solana?: SolanaWalletProvider
  }
  solana?: SolanaWalletProvider
}

export function getPhantomProvider(host: PhantomHost): SolanaWalletProvider | null {
  // Other wallets can overwrite window.solana, so prefer Phantom's namespace.
  if (host.phantom?.solana?.isPhantom) return host.phantom.solana
  if (host.solana?.isPhantom) return host.solana
  return null
}

export function describeProviderError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
    try {
      return JSON.stringify(error)
    } catch {
      return 'Unknown provider error.'
    }
  }
  return String(error)
}

function wasTransactionRejected(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return code === 4001 || /reject|cancel/i.test(describeProviderError(error))
}

export async function signAndSendWithPhantom(
  provider: SolanaWalletProvider,
  transaction: { serializeMessage: () => Uint8Array },
): Promise<{ signature: string }> {
  try {
    return await provider.signAndSendTransaction(transaction)
  } catch (primaryError) {
    if (!provider.request || wasTransactionRejected(primaryError)) throw primaryError

    // The legacy request path is documented by Phantom and helps extensions
    // where the convenience method fails without presenting a confirmation UI.
    return provider.request({
      method: 'signAndSendTransaction',
      params: { message: bs58.encode(transaction.serializeMessage()) },
    })
  }
}
