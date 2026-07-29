import {
  createReceipt,
  type AuditReceipt,
  type AuditReceiptInput,
} from './receipt'

type ReceiptInput = Omit<AuditReceiptInput, 'previousHash'>
type ReceiptFactory = typeof createReceipt

export function createReceiptAppender(
  onAppend: (receipt: AuditReceipt) => Promise<void> | void,
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
      await onAppend(receipt)
      tip = receipt
      return receipt
    })

    queue = append.then(
      () => undefined,
      () => undefined,
    )
    return append
  }
}
