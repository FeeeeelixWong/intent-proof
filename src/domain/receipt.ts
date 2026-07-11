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
