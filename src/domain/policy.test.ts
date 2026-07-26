import { describe, expect, it } from 'vitest'
import { actionFingerprint, evaluateAction, type AgentPolicy } from './policy'

const policy: AgentPolicy = {
  allowedRecipients: ['Recipient111'],
  dailyLimitSol: 0.2,
  maxAmountSol: 0.05,
  requireIntentNote: true,
}

const validDraft = {
  amountSol: 0.025,
  intentNote: 'Pay devnet test invoice',
  recipient: 'Recipient111',
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

  // ── Boundary: invalid amounts ──────────────────────────────────────

  it('blocks a NaN transfer amount', () => {
    const result = evaluateAction(
      { ...validDraft, amountSol: NaN },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
  })

  it('blocks a zero transfer amount', () => {
    const result = evaluateAction(
      { ...validDraft, amountSol: 0 },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
  })

  it('blocks a negative transfer amount', () => {
    const result = evaluateAction(
      { ...validDraft, amountSol: -1 },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
  })

  // ── Boundary: per-action cap ───────────────────────────────────────

  it('blocks an amount above the per-action cap', () => {
    const result = evaluateAction(
      { ...validDraft, amountSol: 0.051 },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Per-action budget')
  })

  it('allows an amount exactly equal to the per-action cap', () => {
    const result = evaluateAction(
      { ...validDraft, amountSol: 0.05 },
      policy,
      0,
    )

    expect(result.decision).toBe('ALLOW')
  })

  // ── Boundary: daily cap ────────────────────────────────────────────

  it('allows a transfer that exactly reaches the daily cap', () => {
    // spentTodaySol=0.15 + amountSol=0.05 = dailyLimitSol=0.2
    const result = evaluateAction(
      { ...validDraft, amountSol: 0.05 },
      policy,
      0.15,
    )

    expect(result.decision).toBe('ALLOW')
  })

  it('blocks a transfer exceeding the daily cap by the smallest practical value', () => {
    // spentTodaySol=0.18 + amountSol=0.03 = 0.21 > dailyLimitSol=0.2
    // amountSol=0.03 is within per-action cap (0.05), so daily budget check is reached
    const result = evaluateAction(
      { ...validDraft, amountSol: 0.03 },
      policy,
      0.18,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Daily budget')
  })

  // ── Boundary: intent note length ───────────────────────────────────

  it('blocks a required intent note shorter than 12 trimmed characters', () => {
    const result = evaluateAction(
      { ...validDraft, intentNote: 'Short' },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Intent evidence')
  })

  it('allows an intent note exactly 12 trimmed characters', () => {
    const result = evaluateAction(
      { ...validDraft, intentNote: 'Twelve chars' },  // exactly 12 chars
      policy,
      0,
    )

    expect(result.decision).toBe('ALLOW')
  })

  // ── Boundary: whitespace handling ──────────────────────────────────

  it('does not let leading/trailing whitespace bypass the recipient allowlist', () => {
    // Recipient is trimmed, so '  Recipient111  ' should match the allowlist
    const result = evaluateAction(
      { ...validDraft, recipient: '  Recipient111  ' },
      policy,
      0,
    )

    expect(result.decision).toBe('ALLOW')
  })

  it('does not let leading/trailing whitespace bypass the intent note length check', () => {
    // '  Short  ' trimmed === 'Short' (5 chars < 12)
    const result = evaluateAction(
      { ...validDraft, intentNote: '  Short  ' },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Intent evidence')
  })

  it('blocks an unknown recipient even with whitespace around it', () => {
    // '  Unknown111  ' trimmed === 'Unknown111' not in allowlist
    const result = evaluateAction(
      { ...validDraft, recipient: '  Unknown111  ' },
      policy,
      0,
    )

    expect(result.decision).toBe('BLOCK')
    expect(result.reason).toBe('Recipient allowlist')
  })

  // ── Existing: fingerprint binding ──────────────────────────────────

  it('binds an approval to the recipient, amount, and declared intent', () => {
    const approved = actionFingerprint({
      amountSol: 0.025,
      intentNote: 'Pay devnet test invoice',
      recipient: 'Recipient111',
    })

    expect(actionFingerprint({
      amountSol: 0.025,
      intentNote: 'Pay a different invoice',
      recipient: 'Recipient111',
    })).not.toBe(approved)
    expect(actionFingerprint({
      amountSol: 0.03,
      intentNote: 'Pay devnet test invoice',
      recipient: 'Recipient111',
    })).not.toBe(approved)
    expect(actionFingerprint({
      amountSol: 0.025,
      intentNote: 'Pay devnet test invoice',
      recipient: 'Recipient222',
    })).not.toBe(approved)
  })
})