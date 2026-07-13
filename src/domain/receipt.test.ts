import { describe, expect, it } from 'vitest'
import { createReceipt, shortHash } from './receipt'

const action = {
  amountSol: 0.025,
  intentNote: 'Pay approved devnet invoice',
  recipient: 'Recipient111',
}

describe('audit receipts', () => {
  it('creates a hash-linked chain for sequential decisions', async () => {
    const first = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'BLOCK',
      previousHash: null,
      reason: 'Recipient allowlist',
      status: 'blocked',
    })
    const second = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: first.hash,
      reason: 'All local safeguards passed.',
      status: 'approved',
    })

    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(second.previousHash).toBe(first.hash)
    expect(second.hash).not.toBe(first.hash)
    expect(shortHash(first.hash)).toMatch(/^[a-f0-9]{8}\.\.\.[a-f0-9]{6}$/)
  })
})
