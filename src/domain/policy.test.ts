import { describe, expect, it } from 'vitest'
import { evaluateAction, type AgentPolicy } from './policy'

const policy: AgentPolicy = {
  allowedRecipients: ['Recipient111'],
  dailyLimitSol: 0.2,
  maxAmountSol: 0.05,
  requireIntentNote: true,
}

describe('evaluateAction', () => {
  it('allows an action that satisfies every local safeguard', () => {
    const result = evaluateAction(
      { amountSol: 0.025, intentNote: 'Pay devnet test invoice', recipient: 'Recipient111' },
      policy,
      0.1,
    )

    expect(result.decision).toBe('ALLOW')
  })

  it('blocks a recipient that was not locally approved', () => {
    const result = evaluateAction(
      { amountSol: 0.025, intentNote: 'Pay devnet test invoice', recipient: 'Unknown111' },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Recipient allowlist')
  })

  it('blocks a transfer that would exceed the remaining daily budget', () => {
    const result = evaluateAction(
      { amountSol: 0.025, intentNote: 'Pay devnet test invoice', recipient: 'Recipient111' },
      policy,
      0.19,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Daily budget')
  })
})
