import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleAlert,
  ClipboardCheck,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  TerminalSquare,
  Wallet,
  X,
} from 'lucide-react'
import type { Buffer } from 'buffer'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { evaluateAction, type ActionDraft, type AgentPolicy, type PolicyDecision } from './domain/policy'
import { createReceipt, shortHash, type AuditReceipt } from './domain/receipt'
import './App.css'

declare global {
  interface Window {
    solana?: {
      connect: () => Promise<{ publicKey: PublicKey }>
      isPhantom?: boolean
      signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>
    }
  }
}

const DEVNET_RPC = 'https://api.devnet.solana.com'
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const agentId = 'audit-agent.local'

const defaultPolicy: AgentPolicy = {
  allowedRecipients: [],
  dailyLimitSol: 0.2,
  maxAmountSol: 0.05,
  requireIntentNote: true,
}

function compactAddress(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value
}

function statusLabel(status: AuditReceipt['status']): string {
  if (status === 'submitted') return 'Submitted on Devnet'
  if (status === 'approved') return 'Approved locally'
  return 'Blocked locally'
}

function App() {
  const [policy, setPolicy] = useState(defaultPolicy)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('0.025')
  const [intentNote, setIntentNote] = useState('Settle the approved devnet invoice')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [networkState, setNetworkState] = useState<'checking' | 'online' | 'offline'>('checking')
  const [decision, setDecision] = useState<PolicyDecision | null>(null)
  const [receipts, setReceipts] = useState<AuditReceipt[]>([])
  const [isSending, setIsSending] = useState(false)
  const [notice, setNotice] = useState('Ready to assess an agent action.')

  const actionDraft = useMemo<ActionDraft>(
    () => ({ amountSol: Number(amount), intentNote, recipient }),
    [amount, intentNote, recipient],
  )
  const spentTodaySol = useMemo(
    () => receipts.filter((receipt) => receipt.status === 'submitted').reduce((sum, receipt) => sum + receipt.action.amountSol, 0),
    [receipts],
  )
  const connection = useMemo(() => new Connection(DEVNET_RPC, 'confirmed'), [])

  useEffect(() => {
    let mounted = true

    async function checkDevnet() {
      try {
        await connection.getLatestBlockhash('confirmed')
        if (mounted) setNetworkState('online')
      } catch {
        if (mounted) setNetworkState('offline')
      }
    }

    void checkDevnet()
    return () => {
      mounted = false
    }
  }, [connection])

  function addRecipientToAllowlist() {
    try {
      const normalized = new PublicKey(recipient.trim()).toBase58()
      setPolicy((current) => ({
        ...current,
        allowedRecipients: current.allowedRecipients.includes(normalized)
          ? current.allowedRecipients
          : [...current.allowedRecipients, normalized],
      }))
      setRecipient(normalized)
      setNotice('Recipient added to the local allowlist.')
    } catch {
      setNotice('Enter a valid Solana public key before adding an allowlist entry.')
    }
  }

  async function recordDecision(nextDecision: PolicyDecision, status: AuditReceipt['status']) {
    const receipt = await createReceipt({
      action: actionDraft,
      agentId,
      decision: nextDecision.decision,
      previousHash: receipts.at(-1)?.hash ?? null,
      reason: nextDecision.reason,
      status,
    })
    setReceipts((current) => [...current, receipt])
    return receipt
  }

  async function assessAction() {
    const nextDecision = evaluateAction(actionDraft, policy, spentTodaySol)
    setDecision(nextDecision)
    await recordDecision(nextDecision, nextDecision.decision === 'ALLOW' ? 'approved' : 'blocked')
    setNotice(nextDecision.decision === 'ALLOW' ? 'Agent action is approved locally. Connect a Devnet wallet to submit.' : `Action blocked: ${nextDecision.reason}.`)
  }

  async function connectWallet() {
    if (!window.solana?.isPhantom) {
      setNotice('Phantom was not detected. Install Phantom and switch it to Devnet to submit a transfer.')
      return
    }

    try {
      const response = await window.solana.connect()
      setWalletAddress(response.publicKey.toBase58())
      setNotice('Devnet wallet connected. No transaction has been requested.')
    } catch {
      setNotice('Wallet connection was cancelled.')
    }
  }

  async function sendApprovedAction() {
    if (decision?.decision !== 'ALLOW') {
      setNotice('Assess the action and resolve any blocked safeguards first.')
      return
    }
    if (!walletAddress || !window.solana) {
      setNotice('Connect a Phantom wallet on Devnet before submitting.')
      return
    }

    setIsSending(true)
    try {
      const payer = new PublicKey(walletAddress)
      const recipientKey = new PublicKey(actionDraft.recipient.trim())
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer,
          lamports: Math.round(actionDraft.amountSol * LAMPORTS_PER_SOL),
          toPubkey: recipientKey,
        }),
        new TransactionInstruction({
          data: new TextEncoder().encode(`IntentProof:${actionDraft.intentNote.trim()}`) as unknown as Buffer,
          keys: [],
          programId: MEMO_PROGRAM,
        }),
      )
      const latest = await connection.getLatestBlockhash('confirmed')
      transaction.feePayer = payer
      transaction.recentBlockhash = latest.blockhash

      const { signature } = await window.solana.signAndSendTransaction(transaction)
      await connection.confirmTransaction({ ...latest, signature }, 'confirmed')
      const receipt = await createReceipt({
        action: actionDraft,
        agentId,
        decision: 'ALLOW',
        previousHash: receipts.at(-1)?.hash ?? null,
        reason: 'Submitted after local policy approval.',
        status: 'submitted',
        transactionSignature: signature,
      })
      setReceipts((current) => [...current, receipt])
      setNotice('Devnet transfer confirmed and appended to the local evidence chain.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown wallet or network error.'
      setNotice(`No receipt was marked submitted: ${message}`)
    } finally {
      setIsSending(false)
    }
  }

  async function copyLatestReceipt() {
    const receipt = receipts.at(-1)
    if (!receipt) {
      setNotice('Assess an action first to create a receipt.')
      return
    }
    await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2))
    setNotice('Latest receipt copied as JSON.')
  }

  function exportReceipts() {
    const blob = new Blob([JSON.stringify(receipts, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'intent-proof-receipts.json'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Receipt ledger exported as JSON.')
  }

  function loadBlockedExample() {
    setAmount('0.125')
    setIntentNote('Attempt a budget-breaking transfer')
    setNotice('Loaded a deliberately blocked example. Select Assess action to inspect the safeguards.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Fingerprint size={20} /></div>
          <div>
            <div className="brand-name">IntentProof</div>
            <div className="brand-caption">Local controls for Solana agents</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`network-chip ${networkState}`}>
            <Activity size={14} />
            {networkState === 'checking' ? 'Checking Devnet' : networkState === 'online' ? 'Devnet online' : 'Devnet unavailable'}
          </span>
          <button className="button secondary" type="button" onClick={connectWallet} title="Connect a Phantom wallet on Solana Devnet">
            <Wallet size={16} />
            {walletAddress ? compactAddress(walletAddress) : 'Connect Devnet wallet'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="main-column" aria-label="Agent action review">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Agent action review</p>
              <h1>Approve the intent, then sign the transaction.</h1>
              <p className="section-copy">IntentProof keeps the policy decision, user-approved Devnet transaction, and an exportable evidence chain in one local session.</p>
            </div>
            <button className="icon-button" type="button" title="Load a blocked policy example" onClick={loadBlockedExample}>
              <RefreshCw size={18} />
            </button>
          </div>

          <section className="work-surface" aria-labelledby="draft-title">
            <div className="surface-heading">
              <div>
                <span className="step-number">01</span>
                <h2 id="draft-title">Draft an agent action</h2>
              </div>
              <span className="local-chip"><KeyRound size={14} /> Local-only policy</span>
            </div>

            <div className="form-grid">
              <label className="field field-wide">
                <span>Recipient public key</span>
                <div className="input-with-action">
                  <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Paste a Solana Devnet public key" spellCheck="false" />
                  <button className="text-button" type="button" onClick={addRecipientToAllowlist}>Allow</button>
                </div>
              </label>
              <label className="field">
                <span>Amount</span>
                <div className="amount-input"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><span>SOL</span></div>
              </label>
              <label className="field">
                <span>Agent identity</span>
                <div className="read-only"><BadgeCheck size={16} /> {agentId}</div>
              </label>
              <label className="field field-wide">
                <span>Intent note</span>
                <textarea value={intentNote} onChange={(event) => setIntentNote(event.target.value)} rows={3} placeholder="Why should this agent perform the action?" />
                <small>Written into the Devnet transaction memo after policy approval.</small>
              </label>
            </div>

            <div className="surface-footer">
              <div className="notice"><TerminalSquare size={16} />{notice}</div>
              <button className="button primary" type="button" onClick={() => void assessAction()}>
                <ShieldCheck size={17} /> Assess action
              </button>
            </div>
          </section>

          <section className="work-surface policy-surface" aria-labelledby="policy-title">
            <div className="surface-heading">
              <div>
                <span className="step-number">02</span>
                <h2 id="policy-title">Policy result</h2>
              </div>
              {decision && <span className={`decision-pill ${decision.decision.toLowerCase()}`}>{decision.decision === 'ALLOW' ? <Check size={14} /> : <X size={14} />}{decision.decision}</span>}
            </div>

            {decision ? (
              <div className="check-list">
                {decision.checks.map((check) => (
                  <div className={`check-row ${check.passed ? 'passed' : 'failed'}`} key={check.label}>
                    <span className="check-icon">{check.passed ? <Check size={16} /> : <CircleAlert size={16} />}</span>
                    <div><strong>{check.label}</strong><p>{check.detail}</p></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><ClipboardCheck size={22} /><p>Run the local policy engine to see each decision check.</p></div>
            )}

            <div className="surface-footer">
              <span className="policy-summary">Per action <strong>{policy.maxAmountSol.toFixed(3)} SOL</strong> · Daily <strong>{policy.dailyLimitSol.toFixed(3)} SOL</strong></span>
              <button className="button primary" type="button" disabled={decision?.decision !== 'ALLOW' || isSending} onClick={() => void sendApprovedAction()}>
                {isSending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
                {isSending ? 'Submitting...' : 'Approve & send on Devnet'}
              </button>
            </div>
          </section>
        </section>

        <aside className="side-column" aria-label="Policy and receipt ledger">
          <section className="side-surface">
            <div className="side-heading"><h2>Active guardrails</h2><ShieldCheck size={18} /></div>
            <div className="metric-row"><span>Per-action ceiling</span><strong>{policy.maxAmountSol.toFixed(3)} SOL</strong></div>
            <div className="metric-row"><span>Daily committed</span><strong>{spentTodaySol.toFixed(3)} / {policy.dailyLimitSol.toFixed(3)}</strong></div>
            <div className="metric-row"><span>Memo evidence</span><strong>Required</strong></div>
            <div className="allowlist">
              <span>Approved recipients</span>
              {policy.allowedRecipients.length === 0 ? <p>No recipients approved yet.</p> : policy.allowedRecipients.map((address) => <code key={address}>{compactAddress(address)}</code>)}
            </div>
          </section>

          <section className="side-surface ledger-surface">
            <div className="side-heading"><div><h2>Evidence chain</h2><p>{receipts.length} local receipt{receipts.length === 1 ? '' : 's'}</p></div><div className="ledger-actions"><button className="icon-button small" type="button" title="Copy latest receipt JSON" onClick={() => void copyLatestReceipt()}><Copy size={15} /></button><button className="icon-button small" type="button" title="Export all receipt JSON" onClick={exportReceipts}><Download size={15} /></button></div></div>
            {receipts.length === 0 ? (
              <div className="ledger-empty">No decisions recorded. Each assessment creates a hash-linked receipt in this browser session.</div>
            ) : (
              <div className="ledger-list">
                {[...receipts].reverse().map((receipt) => (
                  <article className="receipt" key={receipt.id}>
                    <div className="receipt-top"><span className={`receipt-status ${receipt.status}`}>{statusLabel(receipt.status)}</span><time>{new Date(receipt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
                    <p>{receipt.action.amountSol.toFixed(3)} SOL · {compactAddress(receipt.action.recipient || 'No recipient')}</p>
                    <code>{shortHash(receipt.hash)}</code>
                    {receipt.transactionSignature && <a href={`https://explorer.solana.com/tx/${receipt.transactionSignature}?cluster=devnet`} target="_blank" rel="noreferrer">View Devnet transaction <ArrowUpRight size={13} /></a>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
