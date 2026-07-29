import { describe, expect, it } from 'vitest'
import {
  AUDIT_RECEIPT_SCHEMA,
  calculateReceiptHash,
  createReceipt,
  shortHash,
} from './receipt'

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

    expect(first.schema).toBe(AUDIT_RECEIPT_SCHEMA)
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(second.previousHash).toBe(first.hash)
    expect(second.hash).not.toBe(first.hash)
    expect(shortHash(first.hash)).toMatch(/^[a-f0-9]{8}\.\.\.[a-f0-9]{6}$/)
  })

  it('recomputes the same hash regardless of object key insertion order', async () => {
    const receipt = await createReceipt({
      action,
      agentId: 'audit-agent.local',
      decision: 'ALLOW',
      previousHash: null,
      reason: 'All local safeguards passed.',
      status: 'approved',
    })
    const { hash, ...hashableReceipt } = receipt
    if (!('amountSol' in hashableReceipt.action)) {
      throw new Error('Expected a Solana action.')
    }
    const reorderedReceipt = {
      timestamp: hashableReceipt.timestamp,
      status: hashableReceipt.status,
      schema: hashableReceipt.schema,
      reason: hashableReceipt.reason,
      previousHash: hashableReceipt.previousHash,
      id: hashableReceipt.id,
      decision: hashableReceipt.decision,
      agentId: hashableReceipt.agentId,
      action: {
        recipient: hashableReceipt.action.recipient,
        intentNote: hashableReceipt.action.intentNote,
        amountSol: hashableReceipt.action.amountSol,
      },
    }

    await expect(calculateReceiptHash(reorderedReceipt)).resolves.toBe(hash)
  })
})
