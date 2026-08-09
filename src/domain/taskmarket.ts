export const TASKMARKET_API_BASE_URL = 'https://api.taskmarket.dev/api'
export const TASKMARKET_WEB_BASE_URL = 'https://taskmarket.dev'
export const TASKMARKET_BASE_NETWORK = 'eip155:8453'
export const TASKMARKET_USDC_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export type TaskMarketTaskMode = 'bounty' | 'claim' | 'pitch' | 'benchmark' | 'auction' | string

export type TaskMarketTask = {
  createdAt: string
  description: string
  expiryTime: string
  id: string
  mode: TaskMarketTaskMode
  phase: string
  requester: string
  requesterAgentId: string | null
  reward: string
  status: string
  submissionCount: number
  submissionWindowOpen: boolean
  tags: string[]
}

export type TaskMarketListOptions = {
  deadlineHours?: number
  limit?: number
  maxReward?: string
  minReward?: string
  sort?: 'newest' | 'reward_desc' | 'reward_asc' | 'deadline_asc'
}

export type TaskMarketDelegationDraft = {
  authorizationRequired: true
  mode: TaskMarketTaskMode
  reward: string
  taskId: string
  taskTitle: string
  taskUrl: string
  walletAction: 'none'
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type TaskMarketListResponse = {
  hasMore: boolean
  nextCursor: string | null
  tasks: TaskMarketTask[]
}

export class TaskMarketApiError extends Error {
  readonly status: number
  readonly url: string

  constructor(message: string, status: number, url: string) {
    super(message)
    this.name = 'TaskMarketApiError'
    this.status = status
    this.url = url
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function parseTask(value: unknown): TaskMarketTask {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.description !== 'string'
    || typeof value.reward !== 'string'
    || typeof value.createdAt !== 'string'
    || typeof value.expiryTime !== 'string'
    || typeof value.status !== 'string'
    || typeof value.phase !== 'string'
    || typeof value.requester !== 'string'
    || (value.requesterAgentId !== null && typeof value.requesterAgentId !== 'string')
    || typeof value.mode !== 'string'
    || typeof value.submissionCount !== 'number'
    || typeof value.submissionWindowOpen !== 'boolean'
    || !Array.isArray(value.tags)
    || !value.tags.every((tag) => typeof tag === 'string')) {
    throw new TypeError('TaskMarket returned a task with an invalid shape.')
  }

  if (!/^\d+$/.test(value.reward)) {
    throw new TypeError('TaskMarket returned a task with an invalid USDC reward.')
  }

  return {
    createdAt: value.createdAt,
    description: value.description,
    expiryTime: value.expiryTime,
    id: value.id,
    mode: value.mode,
    phase: value.phase,
    requester: value.requester,
    requesterAgentId: value.requesterAgentId,
    reward: value.reward,
    status: value.status,
    submissionCount: value.submissionCount,
    submissionWindowOpen: value.submissionWindowOpen,
    tags: value.tags,
  }
}

function parseListResponse(value: unknown): TaskMarketListResponse {
  if (!isRecord(value) || !Array.isArray(value.tasks)) {
    throw new TypeError('TaskMarket returned an invalid task list.')
  }

  return {
    hasMore: value.hasMore === true,
    nextCursor: typeof value.nextCursor === 'string' ? value.nextCursor : null,
    tasks: value.tasks.map(parseTask),
  }
}

async function readJson(response: Response, url: string): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string'
      ? body.error
      : `TaskMarket request failed with HTTP ${response.status}.`
    throw new TaskMarketApiError(message, response.status, url)
  }

  return body
}

function taskTitle(description: string): string {
  const firstLine = description.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
  return (firstLine ?? 'Untitled TaskMarket task').replace(/^#+\s*/, '').slice(0, 120)
}

function assertTaskId(taskId: string): string {
  if (!/^0x[a-fA-F0-9]{64}$/.test(taskId)) {
    throw new TypeError('TaskMarket task IDs must be 32-byte hexadecimal values.')
  }
  return taskId
}

export function taskMarketUrl(taskId: string): string {
  return `${TASKMARKET_WEB_BASE_URL}/tasks/${assertTaskId(taskId)}`
}

export function formatTaskMarketUsdc(baseUnits: string): string {
  if (!/^\d+$/.test(baseUnits)) {
    throw new TypeError('TaskMarket USDC amounts must be unsigned base-unit integers.')
  }

  const padded = baseUnits.padStart(7, '0')
  const whole = padded.slice(0, -6)
  const fraction = padded.slice(-6).replace(/0+$/, '')
  return fraction.length === 0 ? whole : `${whole}.${fraction}`
}

export function prepareTaskMarketDelegation(task: TaskMarketTask): TaskMarketDelegationDraft {
  if (task.status !== 'open' || !task.submissionWindowOpen) {
    throw new Error('Only open TaskMarket tasks accepting submissions can be prepared.')
  }

  return {
    authorizationRequired: true,
    mode: task.mode,
    reward: task.reward,
    taskId: task.id,
    taskTitle: taskTitle(task.description),
    taskUrl: taskMarketUrl(task.id),
    walletAction: 'none',
  }
}

export function createTaskMarketClient(
  fetcher: Fetcher = fetch,
  apiBaseUrl = TASKMARKET_API_BASE_URL,
) {
  async function listOpenTasks(options: TaskMarketListOptions = {}): Promise<TaskMarketTask[]> {
    const url = new URL(`${apiBaseUrl}/tasks`)
    url.searchParams.set('status', 'open')
    url.searchParams.set('limit', String(options.limit ?? 20))
    url.searchParams.set('sort', options.sort ?? 'reward_desc')
    if (options.deadlineHours !== undefined) url.searchParams.set('deadlineHours', String(options.deadlineHours))
    if (options.maxReward !== undefined) url.searchParams.set('maxReward', options.maxReward)
    if (options.minReward !== undefined) url.searchParams.set('minReward', options.minReward)

    const body = await readJson(await fetcher(url), url.toString())
    return parseListResponse(body).tasks
  }

  async function getTask(taskId: string): Promise<TaskMarketTask | null> {
    const url = new URL(`${apiBaseUrl}/tasks/${assertTaskId(taskId)}`)
    const response = await fetcher(url)
    if (response.status === 404) return null
    return parseTask(await readJson(response, url.toString()))
  }

  return {
    getTask,
    listOpenTasks,
  }
}
