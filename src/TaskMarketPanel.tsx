import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  createTaskMarketClient,
  formatTaskMarketUsdc,
  prepareTaskMarketDelegation,
  taskMarketUrl,
  type TaskMarketDelegationDraft,
  type TaskMarketTask,
} from './domain/taskmarket'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function taskTitle(description: string): string {
  const firstLine = description.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
  return (firstLine ?? 'Untitled TaskMarket task').replace(/^#+\s*/, '').slice(0, 120)
}

function taskDeadline(expiryTime: string): string {
  const date = new Date(expiryTime)
  if (Number.isNaN(date.getTime())) return 'Deadline unavailable'
  return `Due ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

export function TaskMarketPanel() {
  const client = useMemo(() => createTaskMarketClient(), [])
  const [tasks, setTasks] = useState<TaskMarketTask[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<TaskMarketDelegationDraft | null>(null)

  async function browseTasks() {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const openTasks = await client.listOpenTasks({
        limit: 8,
        minReward: '500000',
      })
      setTasks(openTasks)
      setLoadState('ready')
    } catch (error) {
      setLoadState('error')
      setErrorMessage(error instanceof Error ? error.message : 'TaskMarket could not be reached.')
    }
  }

  function prepareTask(task: TaskMarketTask) {
    try {
      setPrepared(prepareTaskMarketDelegation(task))
    } catch (error) {
      setPrepared(null)
      setErrorMessage(error instanceof Error ? error.message : 'This task is no longer accepting work.')
    }
  }

  return (
    <section className="work-surface taskmarket-surface" aria-labelledby="taskmarket-title">
      <div className="surface-heading">
        <div>
          <span className="step-number">03</span>
          <h2 id="taskmarket-title">Find funded external work</h2>
        </div>
        <span className="local-chip"><ShieldCheck size={14} /> Read-only discovery</span>
      </div>

      <p className="taskmarket-copy">
        Browse open TaskMarket work paid in USDC on Base. IntentProof only reads the public market and prepares a local hand-off; it never creates, funds, claims, or signs a task.
      </p>

      <div className="taskmarket-controls">
        <span className="taskmarket-note"><ExternalLink size={15} /> Minimum reward shown: 0.50 USDC</span>
        <button className="button secondary" type="button" disabled={loadState === 'loading'} onClick={() => void browseTasks()}>
          {loadState === 'loading' ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          {loadState === 'loading' ? 'Loading...' : loadState === 'ready' ? 'Refresh funded work' : 'Browse funded work'}
        </button>
      </div>

      {loadState === 'error' && (
        <div className="taskmarket-error"><CircleAlert size={16} /> {errorMessage ?? 'TaskMarket could not be reached.'}</div>
      )}

      {loadState === 'idle' && (
        <div className="taskmarket-empty">Choose Browse funded work to make one public GET request. No wallet connection is needed.</div>
      )}

      {loadState === 'ready' && tasks.length === 0 && (
        <div className="taskmarket-empty">No open funded tasks matched the minimum reward filter.</div>
      )}

      {tasks.length > 0 && (
        <div className="taskmarket-list">
          {tasks.map((task) => (
            <article className="taskmarket-card" key={task.id}>
              <div className="taskmarket-card-top">
                <span className="taskmarket-reward">{formatTaskMarketUsdc(task.reward)} USDC</span>
                <span className="taskmarket-meta">{task.mode} · {taskDeadline(task.expiryTime)}</span>
              </div>
              <h3>{taskTitle(task.description)}</h3>
              <p>{task.submissionCount} submission{task.submissionCount === 1 ? '' : 's'} · {task.tags.slice(0, 3).join(' · ') || 'general'}</p>
              <div className="taskmarket-card-actions">
                <button className="text-button taskmarket-prepare" type="button" onClick={() => prepareTask(task)}>Prepare local hand-off</button>
                <a href={taskMarketUrl(task.id)} target="_blank" rel="noreferrer">
                  View task <ArrowUpRight size={13} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {prepared && (
        <div className="taskmarket-prepared">
          <strong>Local hand-off prepared: {prepared.taskTitle}</strong>
          <p>
            Review the task at <a href={prepared.taskUrl} target="_blank" rel="noreferrer">{prepared.taskUrl}</a>, then obtain explicit authorization before any wallet action. This step did not spend funds or sign anything.
          </p>
        </div>
      )}
    </section>
  )
}
