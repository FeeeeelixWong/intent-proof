import { describe, expect, it } from 'vitest'
import {
  createReceipt,
  verifyReceiptChain,
  type AuditReceipt,
  type AuditReceiptInput,
} from './receipt'

const action = {
  amountSol: 0.025,
  intentNote: 'Pay approved devnet invoice',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  recipient: 'Recipient111',
}

const firstInput: AuditReceiptInput = {
  action,
  agentId: 'audit-agent.local',
  decision: 'ALLOW',
  previousHash: null,
  reason: 'All local safeguards passed.',
  status: 'approved',
}

/** Builds a three-receipt chain; the last receipt carries a transaction signature. */
async function signedChain(): Promise<AuditReceipt[]> {
  const first = await createReceipt(firstInput)
  const second = await createReceipt({
    ...firstInput,
    decision: 'BLOCK',
    previousHash: first.hash,
    reason: 'Recipient allowlist',
    status: 'blocked',
  })
  const third = await createReceipt({
    ...firstInput,
    decision: 'ALLOW',
    previousHash: second.hash,
    status: 'submitted',
    transactionSignature: 'sig5B7c2f1a9d3e8b4c6f0a2d5e7b9c1d3f5a7b9d1e3f5a7b9d1e3f5a7b9d1e3f5a7b9d1e3f5a7b9d1e3f5a7b9',
  })
  return [first, second, third]
}

describe('verifyReceiptChain', () => {
  it('accepts a valid chain, including a receipt carrying a transaction signature', async () => {
    const receipts = await signedChain()

    await expect(verifyReceiptChain(receipts)).resolves.toEqual({ valid: true })
  })

  it('accepts a single genesis receipt', async () => {
    const first = await createReceipt(firstInput)

    await expect(verifyReceiptChain([first])).resolves.toEqual({ valid: true })
  })

  it('treats an empty chain as valid and documents that behavior', async () => {
    await expect(verifyReceiptChain([])).resolves.toEqual({ valid: true })
  })

  it('rejects a chain whose first receipt does not have previousHash: null', async () => {
    const receipts = await signedChain()
    const tampered = [{ ...receipts[0], previousHash: 'not-null' }, ...receipts.slice(1)]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(0)
    expect(result.reason).toMatch(/previousHash/)
  })

  it('rejects a chain with a broken previousHash link', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      { ...receipts[1], previousHash: 'f'.repeat(64) },
      receipts[2],
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(1)
    expect(result.reason).toMatch(/link/i)
  })

  it('detects an edited action', async () => {
    const receipts = await signedChain()
    const tampered = [
      { ...receipts[0], action: { ...action, amountSol: 9.999 } },
      ...receipts.slice(1),
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(0)
    expect(result.reason).toMatch(/hash/)
  })

  it('detects an edited decision', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      { ...receipts[1], decision: 'ALLOW' as const },
      receipts[2],
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(1)
  })

  it('detects an edited timestamp', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      receipts[1],
      { ...receipts[2], timestamp: '2001-02-03T04:05:06.000Z' },
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(2)
  })

  it('detects an edited status', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      receipts[1],
      { ...receipts[2], status: 'failed' as const },
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(2)
  })

  it('detects an edited transaction signature', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      receipts[1],
      { ...receipts[2], transactionSignature: 'sig-tampered' },
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(2)
    expect(result.reason).toMatch(/hash/)
  })

  it('detects a transaction signature added after creation', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      { ...receipts[1], transactionSignature: 'sig-added-after-creation' },
      receipts[2],
    ]

    const result = await verifyReceiptChain(tampered)

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(1)
  })

  it('does not throw for ordinary invalid input', async () => {
    const receipts = await signedChain()

    await expect(verifyReceiptChain(null as unknown as AuditReceipt[])).resolves.toMatchObject({
      valid: false,
    })
    await expect(verifyReceiptChain('nope' as unknown as AuditReceipt[])).resolves.toMatchObject({
      valid: false,
    })
    await expect(
      verifyReceiptChain([receipts[0], null as unknown as AuditReceipt]),
    ).resolves.toMatchObject({ valid: false, invalidIndex: 1 })
  })

  it('returns { valid: false } instead of throwing when a field holds NaN', async () => {
    const receipts = await signedChain()
    const tampered = [
      { ...receipts[0], action: { ...receipts[0].action, amountSol: Number.NaN } },
      ...receipts.slice(1),
    ]

    const result = await verifyReceiptChain(tampered as AuditReceipt[])

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(0)
    expect(result.reason).toMatch(/hash-recompute-failed/)
  })

  it('returns { valid: false } instead of throwing when a field holds a bigint', async () => {
    const receipts = await signedChain()
    const tampered = [
      receipts[0],
      { ...receipts[1], action: { ...receipts[1].action, amountSol: 25n as unknown as number } },
      receipts[2],
    ]

    const result = await verifyReceiptChain(tampered as AuditReceipt[])

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(1)
    expect(result.reason).toMatch(/hash-recompute-failed/)
  })

  it('returns { valid: false } instead of throwing when a field holds a circular structure', async () => {
    const receipts = await signedChain()
    const circular: { self?: unknown } = {}
    circular.self = circular
    const tampered = [
      receipts[0],
      receipts[1],
      { ...receipts[2], reason: circular as unknown as string },
    ]

    const result = await verifyReceiptChain(tampered as AuditReceipt[])

    expect(result.valid).toBe(false)
    expect(result.invalidIndex).toBe(2)
    expect(result.reason).toMatch(/hash-recompute-failed/)
  })
})
