import { describe, expect, it } from 'vitest'
import { assertTransactionConfirmed } from './solana-confirmation'

describe('Solana transaction confirmation', () => {
  it('accepts a confirmation with no execution error', () => {
    expect(() => assertTransactionConfirmed({ value: { err: null } })).not.toThrow()
  })

  it('rejects a confirmation with an execution error before a receipt can be submitted', () => {
    expect(() => assertTransactionConfirmed({
      value: { err: { InstructionError: [0, 'Custom'] } },
    })).toThrow('Solana transaction execution failed during confirmation.')
  })
})
