export type SolanaTransactionConfirmation = {
  value: {
    err: unknown
  }
}

export function assertTransactionConfirmed(
  confirmation: SolanaTransactionConfirmation,
): void {
  if (confirmation.value.err !== null) {
    throw new Error('Solana transaction execution failed during confirmation.')
  }
}
