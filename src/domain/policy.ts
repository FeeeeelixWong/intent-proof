import { formatLamports, parseLamports } from './sol-amount'

export type AgentPolicy = {
  allowedRecipients: string[]
  maxAmountLamports: string
  dailyLimitLamports: string
  requireIntentNote: boolean
}

export type ActionDraft = {
  amountLamports: string
  intentNote: string
  network: string
  recipient: string
}

export type PolicyDecision = {
  checks: Array<{ label: string; passed: boolean; detail: string }>
  decision: 'ALLOW' | 'BLOCK'
  reason: string
}

const trimAddress = (value: string) => value.trim()

// An approval is only valid for the exact action the operator assessed.
export function actionFingerprint(draft: ActionDraft): string {
  return JSON.stringify({
    amountLamports: parseLamports(draft.amountLamports)?.toString() ?? draft.amountLamports.trim(),
    intentNote: draft.intentNote.trim(),
    network: draft.network,
    recipient: trimAddress(draft.recipient),
  })
}

export function evaluateAction(
  draft: ActionDraft,
  policy: AgentPolicy,
  spentTodayLamports: string,
): PolicyDecision {
  const recipient = trimAddress(draft.recipient)
  const amountLamports = parseLamports(draft.amountLamports)
  const maxAmountLamports = parseLamports(policy.maxAmountLamports)
  const dailyLimitLamports = parseLamports(policy.dailyLimitLamports)
  const spentLamports = parseLamports(spentTodayLamports)
  const hasValidAmount = amountLamports !== null && amountLamports > 0n
  const recipientAllowed = policy.allowedRecipients.includes(recipient)
  const underTransferCap = hasValidAmount
    && maxAmountLamports !== null
    && amountLamports <= maxAmountLamports
  const underDailyCap = hasValidAmount
    && dailyLimitLamports !== null
    && spentLamports !== null
    && amountLamports + spentLamports <= dailyLimitLamports
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
      detail: `Limit ${maxAmountLamports === null ? 'invalid' : formatLamports(policy.maxAmountLamports)} SOL per action.`,
    },
    {
      label: 'Daily budget',
      passed: underDailyCap,
      detail: `${spentLamports === null ? 'invalid' : formatLamports(spentTodayLamports)} / ${dailyLimitLamports === null ? 'invalid' : formatLamports(policy.dailyLimitLamports)} SOL committed today.`,
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
