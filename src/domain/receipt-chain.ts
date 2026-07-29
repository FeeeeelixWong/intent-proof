import { createReceipt, type AuditReceipt } from './receipt'

type ReceiptInput = Omit<AuditReceipt, 'hash' | 'id' | 'previousHash' | 'timestamp'>
type ReceiptFactory = typeof createReceipt

export function createReceiptAppender(
  onAppend: (receipt: AuditReceipt) => void,
  factory: ReceiptFactory = createReceipt,
) {
  let tip: AuditReceipt | null = null
  let queue: Promise<void> = Promise.resolve()

  return function appendReceipt(input: ReceiptInput): Promise<AuditReceipt> {
    const append = queue.then(async () => {
      const receipt = await factory({
        ...input,
        previousHash: tip?.hash ?? null,
      })
      tip = receipt
      onAppend(receipt)
      return receipt
    })

    queue = append.then(
      () => undefined,
      () => undefined,
    )
    return append
  }
}
