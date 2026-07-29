import { describe, expect, it } from 'vitest'
import { calculateReceiptHash, createReceipt } from './receipt'
import { verifyReceiptChain } from './receipt-ledger'
import { createX402PaymentEvidence } from './x402-evidence'

const baseInput = {
  amount: '10000',
  asset: '0xUSDC',
  network: 'eip155:8453',
  payTo: '0xmerchant',
  protocolVersion: 2 as const,
  resource: 'https://api.example.com/report',
  scheme: 'exact',
}

describe('x402 payment evidence', () => {
  it('stores digests instead of sensitive payment payloads', async () => {
    const evidence = await createX402PaymentEvidence({
      ...baseInput,
      facilitator: { id: 'coinbase-cdp' },
      paymentPayload: { authorization: { nonce: 'secret-nonce' } },
      paymentRequired: { accepts: [{ amount: '10000', network: 'eip155:8453' }] },
      settlement: {
        response: { success: true, transaction: '0xtx' },
        success: true,
        transactionHash: '0xtx',
      },
    })

    expect(evidence.digests.paymentRequired).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence.digests.paymentPayload).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(evidence)).not.toContain('secret-nonce')
    expect(evidence.settlement?.transactionHash).toBe('0xtx')
  })

  it('creates the same digest for semantically identical JSON objects', async () => {
    const first = await createX402PaymentEvidence({
      ...baseInput,
      paymentRequired: { network: 'eip155:8453', amount: '10000' },
    })
    const second = await createX402PaymentEvidence({
      ...baseInput,
      paymentRequired: { amount: '10000', network: 'eip155:8453' },
    })

    expect(first.digests.paymentRequired).toBe(second.digests.paymentRequired)
  })

  it('can be embedded in a protocol-neutral settled receipt', async () => {
    const evidence = await createX402PaymentEvidence({
      ...baseInput,
      paymentRequired: { amount: '10000', network: 'eip155:8453' },
      settlement: {
        success: true,
        transactionHash: '0xtx',
      },
    })
    const receipt = await createReceipt({
      action: {
        amount: baseInput.amount,
        asset: baseInput.asset,
        kind: 'x402-payment',
        network: baseInput.network,
        payTo: baseInput.payTo,
        resource: baseInput.resource,
      },
      agentId: 'buyer-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Policy passed and settlement was confirmed.',
      status: 'settled',
    })

    await expect(verifyReceiptChain([receipt])).resolves.toMatchObject({
      issues: [],
      valid: true,
    })
  })

  it('rejects x402 evidence whose payment terms do not match the action', async () => {
    const evidence = await createX402PaymentEvidence({
      ...baseInput,
      amount: '20000',
      paymentRequired: { amount: '20000', network: 'eip155:8453' },
      settlement: { success: true },
    })

    await expect(createReceipt({
      action: {
        amount: baseInput.amount,
        asset: baseInput.asset,
        kind: 'x402-payment',
        network: baseInput.network,
        payTo: baseInput.payTo,
        resource: baseInput.resource,
      },
      agentId: 'buyer-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Mismatched payment',
      status: 'settled',
    })).rejects.toThrow('do not match')
  })

  it('detects a re-hashed receipt with internally inconsistent x402 evidence', async () => {
    const evidence = await createX402PaymentEvidence({
      ...baseInput,
      paymentRequired: { amount: '10000', network: 'eip155:8453' },
      settlement: { success: true },
    })
    const receipt = await createReceipt({
      action: {
        amount: baseInput.amount,
        asset: baseInput.asset,
        kind: 'x402-payment',
        network: baseInput.network,
        payTo: baseInput.payTo,
        resource: baseInput.resource,
      },
      agentId: 'buyer-agent',
      decision: 'ALLOW',
      evidence,
      previousHash: null,
      reason: 'Policy passed and settlement was confirmed.',
      status: 'settled',
    })
    if (receipt.evidence?.kind !== 'x402-payment') {
      throw new Error('Expected x402 evidence.')
    }
    receipt.evidence.amount = '20000'
    const { hash: _oldHash, ...hashableReceipt } = receipt
    receipt.hash = await calculateReceiptHash(hashableReceipt)

    const verification = await verifyReceiptChain([receipt])

    expect(verification.valid).toBe(false)
    expect(verification.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_evidence_binding', index: 0 }),
    ]))
  })
})
