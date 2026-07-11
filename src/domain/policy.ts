export type AgentPolicy = {
  allowedRecipients: string[]
  maxAmountSol: number
  dailyLimitSol: number
  requireIntentNote: boolean
}

export type ActionDraft = {
  amountSol: number
  intentNote: string
  recipient: string
}

export type PolicyDecision = {
  checks: Array<{ label: string; passed: boolean; detail: string }>
  decision: 'ALLOW' | 'BLOCK'
  reason: string
}

const trimAddress = (value: string) => value.trim()

export function evaluateAction(
  draft: ActionDraft,
  policy: AgentPolicy,
  spentTodaySol: number,
): PolicyDecision {
  const recipient = trimAddress(draft.recipient)
  const hasValidAmount = Number.isFinite(draft.amountSol) && draft.amountSol > 0
  const recipientAllowed = policy.allowedRecipients.includes(recipient)
  const underTransferCap = hasValidAmount && draft.amountSol <= policy.maxAmountSol
  const underDailyCap = hasValidAmount && spentTodaySol + draft.amountSol <= policy.dailyLimitSol
  const intentRecorded = !policy.requireIntentNote || draft.intentNote.trim().length >= 12

  const checks = [
    {
      label: 'Recipient allowlist',
      passed: recipientAllowed,
      detail: recipientAllowed ? 'Recipient is approved for this agent.' : 'Add this recipient to the local allowlist first.',
    },
    {
      label: 'Per-action budget',
      passed: underTransferCap,
      detail: `Limit ${policy.maxAmountSol.toFixed(3)} SOL per action.`,
    },
    {
      label: 'Daily budget',
      passed: underDailyCap,
      detail: `${spentTodaySol.toFixed(3)} / ${policy.dailyLimitSol.toFixed(3)} SOL committed today.`,
    },
    {
      label: 'Intent evidence',
      passed: intentRecorded,
      detail: 'A clear 12-character intent note is required for the on-chain memo.',
    },
  ]

  const failedCheck = checks.find((check) => !check.passed)

  return failedCheck
    ? { checks, decision: 'BLOCK', reason: failedCheck.label }
    : { checks, decision: 'ALLOW', reason: 'All local safeguards passed.' }
}
