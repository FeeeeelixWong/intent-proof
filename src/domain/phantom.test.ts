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

  it('uses the documented request fallback only when the method is unsupported', async () => {
    const request = vi.fn().mockResolvedValue({ signature: 'devnet-signature' })
    const unsupported = Object.assign(new Error('Method not found'), { code: -32601 })
    const wallet = provider({
      request,
      signAndSendTransaction: vi.fn().mockRejectedValue(unsupported),
    })

    await expect(signAndSendWithPhantom(wallet, transaction)).resolves.toEqual({ signature: 'devnet-signature' })
    expect(request).toHaveBeenCalledWith({
      method: 'signAndSendTransaction',
      params: { message: expect.any(String) },
    })
  })

  it.each([
    ['a timeout', new Error('Request timed out')],
    ['an internal error', new Error('Unexpected provider error')],
    ['an unknown error', { message: 'Something went wrong' }],
  ])('does not reopen a sign-and-send request after %s', async (_label, failure) => {
    const request = vi.fn()
    const wallet = provider({
      request,
      signAndSendTransaction: vi.fn().mockRejectedValue(failure),
    })

    await expect(signAndSendWithPhantom(wallet, transaction)).rejects.toBe(failure)
    expect(request).not.toHaveBeenCalled()
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
