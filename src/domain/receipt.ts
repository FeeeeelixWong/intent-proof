import type { ActionDraft, PolicyDecision } from './policy'

export const AUDIT_RECEIPT_SCHEMA = 'intentproof.audit-receipt.v1' as const

export type X402PaymentAction = {
  amount: string
  asset: string
  kind: 'x402-payment'
  network: string
  payTo: string
  resource: string
}

export type ReceiptAction = ActionDraft | X402PaymentAction
export type AuditDecision = PolicyDecision['decision'] | 'DENY' | 'HOLD'
export type AuditStatus = 'approved' | 'blocked' | 'failed' | 'settled' | 'submitted'

export type SolanaTransferEvidence = {
  kind: 'solana-transfer'
  network: string
  transactionSignature: string
}

export type X402PaymentEvidence = {
  amount: string
  asset: string
  digests: {
    paymentPayload?: string
    paymentRequired: string
    settlementResponse?: string
  }
  facilitator?: {
    id: string
    url?: string
  }
  kind: 'x402-payment'
  network: string
  payTo: string
  protocolVersion: 1 | 2
  resource: string
  scheme: string
  settlement?: {
    settledAt?: string
    success: boolean
    transactionHash?: string
  }
}

export type AuditReceipt = {
  action: ReceiptAction
  agentId: string
  decision: AuditDecision
  evidence?: SolanaTransferEvidence | X402PaymentEvidence
  hash: string
  id: string
  previousHash: string | null
  reason: string
  schema: typeof AUDIT_RECEIPT_SCHEMA
  status: AuditStatus
  timestamp: string
  transactionSignature?: string
}

export type AuditReceiptInput = Omit<AuditReceipt, 'hash' | 'id' | 'schema' | 'timestamp'>

export function isX402PaymentAction(action: ReceiptAction): action is X402PaymentAction {
  return 'kind' in action && action.kind === 'x402-payment'
}

export function receiptBindingIssues(
  receipt: Pick<AuditReceipt, 'action' | 'evidence' | 'status' | 'transactionSignature'>,
): string[] {
  const issues: string[] = []

  if (!receipt.evidence) {
    if (receipt.status === 'settled') {
      issues.push('A settled receipt must include settlement evidence.')
    }
    return issues
  }

  if (isX402PaymentAction(receipt.action) && receipt.evidence.kind !== 'x402-payment') {
    issues.push('An x402 action cannot be bound to Solana transfer evidence.')
    return issues
  }

  if (!isX402PaymentAction(receipt.action) && receipt.evidence.kind !== 'solana-transfer') {
    issues.push('A Solana action cannot be bound to x402 payment evidence.')
    return issues
  }

  if (isX402PaymentAction(receipt.action) && receipt.evidence.kind === 'x402-payment') {
    const action = receipt.action
    const evidence = receipt.evidence
    if (
      action.amount !== evidence.amount
      || action.asset !== evidence.asset
      || action.network !== evidence.network
      || action.payTo !== evidence.payTo
      || action.resource !== evidence.resource
    ) {
      issues.push('The x402 action fields do not match the attached payment evidence.')
    }
    if (receipt.status === 'settled' && evidence.settlement?.success !== true) {
      issues.push('A settled x402 receipt must include a successful settlement result.')
    }
  }

  if (!isX402PaymentAction(receipt.action) && receipt.evidence.kind === 'solana-transfer') {
    if (receipt.action.network !== receipt.evidence.network) {
      issues.push('The Solana action network does not match its evidence.')
    }
    if (
      receipt.transactionSignature
      && receipt.transactionSignature !== receipt.evidence.transactionSignature
    ) {
      issues.push('The Solana transaction signature does not match its evidence.')
    }
  }

  return issues
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJson)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry) => entry[1] !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entryValue]) => [key, normalizeJson(entryValue)]),
    )
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('IntentProof evidence cannot contain non-finite numbers.')
  }

  if (typeof value === 'bigint') {
    throw new TypeError('IntentProof evidence must encode bigint values as decimal strings.')
  }

  return value
}

export function canonicalJson(value: unknown): string {
  const json = JSON.stringify(normalizeJson(value))
  if (json === undefined) {
    throw new TypeError('IntentProof evidence must contain a JSON value.')
  }
  return json
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function calculateReceiptHash(receipt: Omit<AuditReceipt, 'hash'>): Promise<string> {
  return sha256(canonicalJson(receipt))
}

export async function createReceipt(input: AuditReceiptInput): Promise<AuditReceipt> {
  const bindingIssues = receiptBindingIssues(input)
  if (bindingIssues.length > 0) {
    throw new TypeError(bindingIssues.join(' '))
  }

  const timestamp = new Date().toISOString()
  const id = crypto.randomUUID()
  const receipt = {
    ...input,
    id,
    schema: AUDIT_RECEIPT_SCHEMA,
    timestamp,
  }

  return {
    ...receipt,
    hash: await calculateReceiptHash(receipt),
  }
}

export type ReceiptChainVerificationResult = {
  /** Index of the first receipt that failed verification. Present only when `valid` is false. */
  invalidIndex?: number
  /** Human-readable reason the chain failed verification. Present only when `valid` is false. */
  reason?: string
  valid: boolean
}

/**
 * Deterministically verifies an exported audit receipt chain.
 *
 * For every receipt it recomputes the hash from the exact same fields `createReceipt`
 * hashed — everything except `hash`, including `transactionSignature` when it is
 * present — and reports failure when content or links were modified after creation.
 * It also requires the first receipt to have `previousHash: null` and every later
 * receipt's `previousHash` to equal the preceding receipt's hash.
 *
 * An empty chain is valid: there are no links to break and no hashes to mismatch.
 * Ordinary invalid input (non-array input, non-object entries, broken links,
 * tampered content) yields `{ valid: false }` — never a throw.
 */
export async function verifyReceiptChain(
  receipts: readonly AuditReceipt[],
): Promise<ReceiptChainVerificationResult> {
  if (!Array.isArray(receipts)) {
    return {
      reason: 'The receipt chain must be an array of audit receipts.',
      valid: false,
    }
  }

  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index]

    if (receipt === null || typeof receipt !== 'object') {
      return {
        invalidIndex: index,
        reason: `Receipt ${index} is not a valid receipt object.`,
        valid: false,
      }
    }

    if (index === 0) {
      if (receipt.previousHash !== null) {
        return {
          invalidIndex: index,
          reason: 'The first receipt in a chain must have previousHash set to null.',
          valid: false,
        }
      }
    } else if (receipt.previousHash !== receipts[index - 1].hash) {
      return {
        invalidIndex: index,
        reason: 'The receipt does not link to the immediately preceding receipt hash.',
        valid: false,
      }
    }

    // Recompute from the same payload createReceipt hashed: every field except
    // `hash`. transactionSignature is intentionally included when present, so
    // adding, removing, or editing it after creation invalidates the receipt.
    const { hash, ...hashableReceipt } = receipt
    let expectedHash: string
    try {
      expectedHash = await calculateReceiptHash(hashableReceipt)
    } catch {
      // Content that cannot be canonicalized (non-finite numbers, bigint
      // values, circular structures, ...) is invalid input, not a throw.
      return {
        invalidIndex: index,
        reason: 'The receipt content could not be hashed (hash-recompute-failed).',
        valid: false,
      }
    }
    if (hash !== expectedHash) {
      return {
        invalidIndex: index,
        reason: 'The receipt content does not match its claimed hash and may have been modified after creation.',
        valid: false,
      }
    }
  }

  return { valid: true }
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return 'Genesis'
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}
