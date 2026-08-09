import { describe, expect, it } from 'vitest'
import { actionFingerprint, evaluateAction, type AgentPolicy } from './policy'

const policy: AgentPolicy = {
  allowedRecipients: ['Recipient111'],
  dailyLimitLamports: '200000000',
  maxAmountLamports: '50000000',
  requireIntentNote: true,
}
const network = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

describe('evaluateAction', () => {
  it('allows an action that satisfies every local safeguard', () => {
    const result = evaluateAction(
      { amountLamports: '25000000', intentNote: 'Pay devnet test invoice', network, recipient: 'Recipient111' },
      policy,
      '100000000',
    )

    expect(result.decision).toBe('ALLOW')
  })

  it('blocks a recipient that was not locally approved', () => {
    const result = evaluateAction(
      { amountLamports: '25000000', intentNote: 'Pay devnet test invoice', network, recipient: 'Unknown111' },
      policy,
      '0',
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Recipient allowlist')
  })

  it('blocks a transfer that would exceed the remaining daily budget', () => {
    const result = evaluateAction(
      { amountLamports: '25000000', intentNote: 'Pay devnet test invoice', network, recipient: 'Recipient111' },
      policy,
      '190000000',
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Daily budget')
  })

  it('blocks an amount that is not a canonical lamport integer', () => {
    const result = evaluateAction(
      { amountLamports: '', intentNote: 'Pay devnet test invoice', network, recipient: 'Recipient111' },
      policy,
      '0',
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Per-action budget')
  })

  it('binds an approval to the recipient, amount, and declared intent', () => {
    const approved = actionFingerprint({
      amountLamports: '25000000',
      intentNote: 'Pay devnet test invoice',
      network,
      recipient: 'Recipient111',
    })

    expect(actionFingerprint({
      amountLamports: '25000000',
      intentNote: 'Pay a different invoice',
      network,
      recipient: 'Recipient111',
    })).not.toBe(approved)
    expect(actionFingerprint({
      amountLamports: '30000000',
      intentNote: 'Pay devnet test invoice',
      network,
      recipient: 'Recipient111',
    })).not.toBe(approved)
    expect(actionFingerprint({
      amountLamports: '25000000',
      intentNote: 'Pay devnet test invoice',
      network,
      recipient: 'Recipient222',
    })).not.toBe(approved)
    expect(actionFingerprint({
      amountLamports: '25000000',
      intentNote: 'Pay devnet test invoice',
      network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      recipient: 'Recipient111',
    })).not.toBe(approved)
  })
})
