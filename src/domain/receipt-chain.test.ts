import { describe, expect, it } from 'vitest'
import type { ActionDraft } from './policy'
import { createReceiptAppender } from './receipt-chain'

const action: ActionDraft = {
  amountLamports: '10000000',
  intentNote: 'Concurrent append regression',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  recipient: '11111111111111111111111111111111',
}

describe('receipt appender', () => {
  it('serializes concurrent appends against the latest committed tip', async () => {
    const receipts: Awaited<ReturnType<ReturnType<typeof createReceiptAppender>>>[] = []
    const append = createReceiptAppender((receipt) => {
      receipts.push(receipt)
    })

    await Promise.all([
      append({ action, agentId: 'agent', decision: 'ALLOW', reason: 'one', status: 'approved' }),
      append({ action, agentId: 'agent', decision: 'BLOCK', reason: 'two', status: 'blocked' }),
      append({ action, agentId: 'agent', decision: 'ALLOW', reason: 'three', status: 'submitted' }),
    ])

    expect(receipts).toHaveLength(3)
    expect(receipts[0].previousHash).toBeNull()
    expect(receipts[1].previousHash).toBe(receipts[0].hash)
    expect(receipts[2].previousHash).toBe(receipts[1].hash)
  })

  it('does not advance the committed tip when durable append fails', async () => {
    const receipts: Awaited<ReturnType<ReturnType<typeof createReceiptAppender>>>[] = []
    let shouldReject = true
    const append = createReceiptAppender((receipt) => {
      if (shouldReject) {
        shouldReject = false
        throw new Error('storage unavailable')
      }
      receipts.push(receipt)
    })

    await expect(append({
      action,
      agentId: 'agent',
      decision: 'ALLOW',
      reason: 'failed append',
      status: 'approved',
    })).rejects.toThrow('storage unavailable')

    await expect(append({
      action,
      agentId: 'agent',
      decision: 'BLOCK',
      reason: 'recovered append',
      status: 'blocked',
    })).resolves.toMatchObject({ previousHash: null })
    expect(receipts).toHaveLength(1)
  })
})
