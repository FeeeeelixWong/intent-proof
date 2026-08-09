/** The number of lamports in one SOL. Kept as bigint so conversions are exact. */
export const LAMPORTS_PER_SOL = 1_000_000_000n

const MAX_SAFE_LAMPORTS = BigInt(Number.MAX_SAFE_INTEGER)
const SOL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,9}))?$/
const LAMPORTS_PATTERN = /^(?:0|[1-9]\d*)$/

/** Decimal lamports are the serialized, canonical monetary representation. */
export type Lamports = string

/**
 * Parse a canonical decimal lamport string, allowing zero for budget counters.
 * Values stay within the safe integer range required by web3.js transaction APIs.
 */
export function parseLamports(value: string): bigint | null {
  if (!LAMPORTS_PATTERN.test(value)) return null
  const lamports = BigInt(value)
  return lamports <= MAX_SAFE_LAMPORTS ? lamports : null
}

/**
 * Convert a user-entered SOL decimal to canonical lamports.
 * Scientific notation, surrounding whitespace, zero, negative values, and
 * precision beyond one lamport are rejected before policy evaluation.
 */
export function parseSolAmount(value: string): Lamports | null {
  if (value.trim() !== value) return null
  const match = SOL_AMOUNT_PATTERN.exec(value)
  if (!match) return null

  const whole = value.split('.')[0]
  const fraction = match[1] ?? ''
  const lamports = BigInt(whole) * LAMPORTS_PER_SOL
    + BigInt(fraction.padEnd(9, '0') || '0')

  if (lamports <= 0n || lamports > MAX_SAFE_LAMPORTS) return null
  return lamports.toString()
}

export function lamportsToNumber(value: Lamports): number {
  const lamports = parseLamports(value)
  if (lamports === null) throw new TypeError('Invalid or unsafe lamport amount.')
  return Number(lamports)
}

export function addLamports(left: Lamports, right: Lamports): Lamports {
  const leftValue = parseLamports(left)
  const rightValue = parseLamports(right)
  if (leftValue === null || rightValue === null) throw new TypeError('Invalid lamport amount.')

  const total = leftValue + rightValue
  if (total > MAX_SAFE_LAMPORTS) throw new RangeError('Lamport total exceeds the safe transaction range.')
  return total.toString()
}

export function compareLamports(left: Lamports, right: Lamports): -1 | 0 | 1 {
  const leftValue = parseLamports(left)
  const rightValue = parseLamports(right)
  if (leftValue === null || rightValue === null) throw new TypeError('Invalid lamport amount.')
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}

/** Format only for display; policy and transaction logic must use lamports. */
export function formatLamports(value: Lamports, fractionDigits = 3): string {
  const lamports = parseLamports(value)
  if (lamports === null) throw new TypeError('Invalid lamport amount.')
  const digits = Math.max(0, Math.min(9, Math.trunc(fractionDigits)))
  let whole = lamports / LAMPORTS_PER_SOL
  const fraction = lamports % LAMPORTS_PER_SOL

  if (digits === 0) {
    if (fraction >= LAMPORTS_PER_SOL / 2n) whole += 1n
    return whole.toString()
  }

  const scale = 10n ** BigInt(9 - digits)
  let roundedFraction = (fraction + scale / 2n) / scale
  const fractionLimit = 10n ** BigInt(digits)
  if (roundedFraction >= fractionLimit) {
    whole += 1n
    roundedFraction = 0n
  }

  return `${whole.toString()}.${roundedFraction.toString().padStart(digits, '0')}`
}
