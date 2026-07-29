import { describe, expect, it } from 'vitest'
import { createReceipt } from './receipt'
import {
  createReceiptLedgerBundle,
  verifyReceiptChain,
  verifyReceiptLedgerBundle,
} from './receipt-ledger'

const action = {
  amountSol: 0.025,
  intentNote: 'Pay approved devnet invoice',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  recipient: 'Recipient111',
}

async function receiptChain() {
  const first = await createReceipt({
    action,
    agentId: 'audit-agent.local',
    decision: 'ALLOW',
    previousHash: null,
    reason: 'All local safeguards passed.',
    status: 'approved',
  })
  const second = await createReceipt({
    action,
    agentId: 'audit-agent.local',
    decision: 'ALLOW',
    previousHash: first.hash,
    reason: 'Submitted after local policy approval.',
    status: 'submitted',
    transactionSignature: 'devnet-signature',
  })
  return [first, second]
}

describe('receipt ledger verification', () => {
  it('verifies an intact exported ledger bundle', async () => {
    const receipts = await receiptChain()
    const bundle = createReceiptLedgerBundle(receipts, '2026-07-29T00:00:00.000Z')

    await expect(verifyReceiptLedgerBundle(bundle)).resolves.toMatchObject({
      issues: [],
      receiptCount: 2,
      tipHash: receipts[1].hash,
      valid: true,
    })
  })

  it('detects content tampering even when the links are unchanged', async () => {
    const receipts = await receiptChain()
    const tampered = structuredClone(receipts)
    tampered[0].reason = 'Tampered decision'

    const verification = await verifyReceiptChain(tampered)

    expect(verification.valid).toBe(false)
    expect(verification.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'hash_mismatch', index: 0 }),
    ]))
  })

  it('detects a fork that skips the immediate predecessor', async () => {
    const receipts = await receiptChain()
    const forked = structuredClone(receipts)
    forked[1].previousHash = null

    const verification = await verifyReceiptChain(forked)

    expect(verification.valid).toBe(false)
    expect(verification.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_previous_hash', index: 1 }),
    ]))
  })

  it('detects ledger metadata that does not describe the included chain', async () => {
    const receipts = await receiptChain()
    const bundle = createReceiptLedgerBundle(receipts)
    bundle.chain.receiptCount = 99

    const verification = await verifyReceiptLedgerBundle(bundle)

    expect(verification.valid).toBe(false)
    expect(verification.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_ledger_metadata', index: -1 }),
    ]))
  })
})
