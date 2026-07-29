import {
  AUDIT_RECEIPT_SCHEMA,
  calculateReceiptHash,
  receiptBindingIssues,
  type AuditReceipt,
} from './receipt'

export const RECEIPT_LEDGER_SCHEMA = 'intentproof.receipt-ledger.v1' as const

export type ReceiptLedgerBundle = {
  chain: {
    algorithm: 'SHA-256'
    genesisHash: string | null
    receiptCount: number
    tipHash: string | null
  }
  exportedAt: string
  receipts: AuditReceipt[]
  schema: typeof RECEIPT_LEDGER_SCHEMA
}

export type ReceiptChainIssue = {
  code:
    | 'duplicate_hash'
    | 'duplicate_id'
    | 'hash_mismatch'
    | 'invalid_ledger_metadata'
    | 'invalid_previous_hash'
    | 'invalid_receipt_schema'
    | 'invalid_evidence_binding'
  index: number
  message: string
}

export type ReceiptChainVerification = {
  issues: ReceiptChainIssue[]
  receiptCount: number
  tipHash: string | null
  valid: boolean
}

export async function verifyReceiptChain(receipts: readonly AuditReceipt[]): Promise<ReceiptChainVerification> {
  const issues: ReceiptChainIssue[] = []
  const seenHashes = new Set<string>()
  const seenIds = new Set<string>()

  for (const [index, receipt] of receipts.entries()) {
    const expectedPreviousHash = index === 0 ? null : receipts[index - 1].hash
    if (receipt.previousHash !== expectedPreviousHash) {
      issues.push({
        code: 'invalid_previous_hash',
        index,
        message: `Receipt ${index} does not reference the immediately preceding receipt.`,
      })
    }

    if (receipt.schema !== AUDIT_RECEIPT_SCHEMA) {
      issues.push({
        code: 'invalid_receipt_schema',
        index,
        message: `Receipt ${index} uses an unsupported schema.`,
      })
    }

    if (receiptBindingIssues(receipt).length > 0) {
      issues.push({
        code: 'invalid_evidence_binding',
        index,
        message: `Receipt ${index} contains evidence that does not match its action or status.`,
      })
    }

    if (seenIds.has(receipt.id)) {
      issues.push({
        code: 'duplicate_id',
        index,
        message: `Receipt ${index} reuses an earlier receipt id.`,
      })
    }
    seenIds.add(receipt.id)

    if (seenHashes.has(receipt.hash)) {
      issues.push({
        code: 'duplicate_hash',
        index,
        message: `Receipt ${index} reuses an earlier receipt hash.`,
      })
    }
    seenHashes.add(receipt.hash)

    const { hash: claimedHash, ...hashableReceipt } = receipt
    const calculatedHash = await calculateReceiptHash(hashableReceipt)
    if (claimedHash !== calculatedHash) {
      issues.push({
        code: 'hash_mismatch',
        index,
        message: `Receipt ${index} content does not match its claimed hash.`,
      })
    }
  }

  return {
    issues,
    receiptCount: receipts.length,
    tipHash: receipts.at(-1)?.hash ?? null,
    valid: issues.length === 0,
  }
}

export function createReceiptLedgerBundle(
  receipts: readonly AuditReceipt[],
  exportedAt = new Date().toISOString(),
): ReceiptLedgerBundle {
  return {
    chain: {
      algorithm: 'SHA-256',
      genesisHash: receipts[0]?.hash ?? null,
      receiptCount: receipts.length,
      tipHash: receipts.at(-1)?.hash ?? null,
    },
    exportedAt,
    receipts: [...receipts],
    schema: RECEIPT_LEDGER_SCHEMA,
  }
}

export async function verifyReceiptLedgerBundle(bundle: ReceiptLedgerBundle): Promise<ReceiptChainVerification> {
  const verification = await verifyReceiptChain(bundle.receipts)
  const metadataMatches = bundle.schema === RECEIPT_LEDGER_SCHEMA
    && bundle.chain.algorithm === 'SHA-256'
    && bundle.chain.receiptCount === bundle.receipts.length
    && bundle.chain.genesisHash === (bundle.receipts[0]?.hash ?? null)
    && bundle.chain.tipHash === verification.tipHash

  if (metadataMatches) return verification

  return {
    ...verification,
    issues: [
      ...verification.issues,
      {
        code: 'invalid_ledger_metadata',
        index: -1,
        message: 'Ledger metadata does not match the included receipt chain.',
      },
    ],
    valid: false,
  }
}
