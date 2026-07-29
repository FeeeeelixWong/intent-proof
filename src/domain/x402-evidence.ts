import {
  canonicalJson,
  sha256,
  type X402PaymentEvidence,
} from './receipt'

type EvidenceDocument = string | Record<string, unknown>

export type X402EvidenceInput = {
  amount: string
  asset: string
  facilitator?: {
    id: string
    url?: string
  }
  network: string
  payTo: string
  paymentPayload?: EvidenceDocument
  paymentRequired: EvidenceDocument
  protocolVersion: 1 | 2
  resource: string
  scheme: string
  settlement?: {
    response?: EvidenceDocument
    settledAt?: string
    success: boolean
    transactionHash?: string
  }
}

function evidenceSource(document: EvidenceDocument): string {
  return typeof document === 'string' ? document : canonicalJson(document)
}

async function digestDocument(document: EvidenceDocument): Promise<string> {
  return sha256(evidenceSource(document))
}

export async function createX402PaymentEvidence(input: X402EvidenceInput): Promise<X402PaymentEvidence> {
  return {
    amount: input.amount,
    asset: input.asset,
    digests: {
      paymentPayload: input.paymentPayload !== undefined
        ? await digestDocument(input.paymentPayload)
        : undefined,
      paymentRequired: await digestDocument(input.paymentRequired),
      settlementResponse: input.settlement?.response !== undefined
        ? await digestDocument(input.settlement.response)
        : undefined,
    },
    facilitator: input.facilitator,
    kind: 'x402-payment',
    network: input.network,
    payTo: input.payTo,
    protocolVersion: input.protocolVersion,
    resource: input.resource,
    scheme: input.scheme,
    settlement: input.settlement
      ? {
          settledAt: input.settlement.settledAt,
          success: input.settlement.success,
          transactionHash: input.settlement.transactionHash,
        }
      : undefined,
  }
}
