import type { ActionDraft, PolicyDecision } from './policy'

export type AuditReceipt = {
  action: ActionDraft
  agentId: string
  decision: PolicyDecision['decision']
  hash: string
  id: string
  previousHash: string | null
  reason: string
  status: 'approved' | 'blocked' | 'submitted'
  timestamp: string
  transactionSignature?: string
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createReceipt(input: Omit<AuditReceipt, 'hash' | 'id' | 'timestamp'>): Promise<AuditReceipt> {
  const timestamp = new Date().toISOString()
  const id = crypto.randomUUID()
  const payload = JSON.stringify({ ...input, id, timestamp })

  return {
    ...input,
    hash: await sha256(payload),
    id,
    timestamp,
  }
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return 'Genesis'
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

export type VerificationResult = {
  valid: boolean
  errors: string[]
}

export async function verifyReceiptChain(receipts: AuditReceipt[]): Promise<VerificationResult> {
  const errors: string[] = []

  if (receipts.length === 0) {
    return { valid: true, errors: [] }
  }

  if (receipts[0].previousHash !== null) {
    errors.push(`First receipt's previousHash is "${receipts[0].previousHash}", expected null`)
  }

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]

    const { hash: _storedHash, transactionSignature: _txSig, ...fields } = receipt
    const payload = JSON.stringify(fields)
    const expectedHash = await sha256(payload)

    if (expectedHash !== receipt.hash) {
      errors.push(`Receipt ${i} hash mismatch: expected "${expectedHash}", got "${receipt.hash}"`)
    }

    if (i > 0) {
      const prev = receipts[i - 1]
      if (receipt.previousHash !== prev.hash) {
        errors.push(`Receipt ${i} previousHash "${receipt.previousHash}" does not match receipt ${i - 1} hash "${prev.hash}"`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
