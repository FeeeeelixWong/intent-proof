import { describe, expect, it } from 'vitest'
import { createReceipt, shortHash, verifyReceiptChain } from './receipt'

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

  it('verifyReceiptChain validates a valid chain', async () => {
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
    const third = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: second.hash,
      reason: 'Submitted to chain.',
      status: 'submitted',
    })

    const result = await verifyReceiptChain([first, second, third])
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('verifyReceiptChain rejects chain with invalid first receipt previousHash', async () => {
    const receipt = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: null,
      reason: 'Test',
      status: 'approved',
    })
    const tampered = { ...receipt, previousHash: 'fake-hash' }

    const result = await verifyReceiptChain([tampered])
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0]).toContain('previousHash')
  })

  it('verifyReceiptChain rejects chain with broken hash linkage', async () => {
    const first = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: null,
      reason: 'First',
      status: 'approved',
    })
    const second = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: first.hash,
      reason: 'Second',
      status: 'approved',
    })
    const tampered = { ...second, previousHash: 'wrong-hash' }

    const result = await verifyReceiptChain([first, tampered])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('previousHash'))).toBe(true)
  })

  it('verifyReceiptChain rejects chain with tampered content', async () => {
    const first = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: null,
      reason: 'Original reason',
      status: 'approved',
    })
    const tampered = { ...first, reason: 'Tampered reason' }

    const result = await verifyReceiptChain([tampered])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('hash mismatch'))).toBe(true)
  })

  it('verifyReceiptChain returns valid for empty chain', async () => {
    const result = await verifyReceiptChain([])
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('verifyReceiptChain returns valid for single receipt', async () => {
    const receipt = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: null,
      reason: 'Single receipt',
      status: 'approved',
    })

    const result = await verifyReceiptChain([receipt])
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
