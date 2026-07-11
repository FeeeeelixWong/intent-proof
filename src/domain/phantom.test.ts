import { describe, expect, it, vi } from 'vitest'
import {
  getPhantomProvider,
  signAndSendWithPhantom,
  type SolanaWalletProvider,
} from './phantom'

function provider(overrides: Partial<SolanaWalletProvider> = {}): SolanaWalletProvider {
  return {
    connect: vi.fn(),
    isPhantom: true,
    signAndSendTransaction: vi.fn(),
    ...overrides,
  }
}

const transaction = { serializeMessage: () => new Uint8Array([1, 2, 3]) }

describe('Phantom provider integration', () => {
  it('prefers Phantom\'s namespace over a competing legacy provider', () => {
    const phantom = provider()
    const competingProvider = provider()

    expect(getPhantomProvider({ phantom: { solana: phantom }, solana: competingProvider })).toBe(phantom)
  })

  it('uses the documented request fallback when the convenience method fails', async () => {
    const request = vi.fn().mockResolvedValue({ signature: 'devnet-signature' })
    const wallet = provider({
      request,
      signAndSendTransaction: vi.fn().mockRejectedValue(new Error('Unexpected error')),
    })

    await expect(signAndSendWithPhantom(wallet, transaction)).resolves.toEqual({ signature: 'devnet-signature' })
    expect(request).toHaveBeenCalledWith({
      method: 'signAndSendTransaction',
      params: { message: expect.any(String) },
    })
  })

  it('does not reopen a signing request after the user rejects it', async () => {
    const request = vi.fn()
    const rejection = Object.assign(new Error('User rejected the request'), { code: 4001 })
    const wallet = provider({
      request,
      signAndSendTransaction: vi.fn().mockRejectedValue(rejection),
    })

    await expect(signAndSendWithPhantom(wallet, transaction)).rejects.toBe(rejection)
    expect(request).not.toHaveBeenCalled()
  })
})
