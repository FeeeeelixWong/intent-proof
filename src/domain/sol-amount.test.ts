import { describe, expect, it } from 'vitest'
import {
  addLamports,
  compareLamports,
  formatLamports,
  lamportsToNumber,
  parseLamports,
  parseSolAmount,
} from './sol-amount'

describe('canonical SOL amounts', () => {
  it('converts decimal SOL to exact lamports', () => {
    expect(parseSolAmount('0.025')).toBe('25000000')
    expect(parseSolAmount('1.000000001')).toBe('1000000001')
  })

  it('rejects values that cannot represent an exact lamport transfer', () => {
    expect(parseSolAmount('0.0000000004')).toBeNull()
    expect(parseSolAmount('1e-3')).toBeNull()
    expect(parseSolAmount('0')).toBeNull()
    expect(parseSolAmount('-0.1')).toBeNull()
    expect(parseSolAmount(' 0.1')).toBeNull()
    expect(parseSolAmount('0.1 ')).toBeNull()
  })

  it('rejects non-canonical or unsafe serialized lamports', () => {
    expect(parseLamports('02500000')).toBeNull()
    expect(parseLamports('1.5')).toBeNull()
    expect(parseLamports('9007199254740992')).toBeNull()
    expect(parseLamports('25000000')).toBe(25000000n)
  })

  it('keeps policy arithmetic in integers', () => {
    expect(addLamports('100000000', '100000001')).toBe('200000001')
    expect(compareLamports('100000000', '100000001')).toBe(-1)
    expect(compareLamports('100000001', '100000001')).toBe(0)
    expect(compareLamports('100000002', '100000001')).toBe(1)
  })

  it('rounds only the display value and preserves transaction precision', () => {
    expect(formatLamports('25000000')).toBe('0.025')
    expect(formatLamports('999999999', 3)).toBe('1.000')
    expect(lamportsToNumber('25000000')).toBe(25000000)
  })
})
