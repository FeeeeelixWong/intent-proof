import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

describe('App accessibility semantics', () => {
  it('announces changing policy and connectivity feedback', () => {
    expect(appSource).toContain(
      'className={`network-chip ${networkState}`} role="status" aria-atomic="true"',
    )
    expect(appSource).toContain(
      'className="notice" role="status" aria-live="polite" aria-atomic="true"',
    )
    expect(appSource).toContain(
      'className={`integrity-chip ${ledgerIntegrity}`} role="status" aria-atomic="true"',
    )
  })

  it.each([
    'Load a blocked policy example',
    'Copy latest receipt JSON',
    'Export verified evidence bundle',
  ])('gives the %s icon control an explicit accessible name', (label) => {
    expect(appSource).toContain(`aria-label="${label}"`)
  })
})
