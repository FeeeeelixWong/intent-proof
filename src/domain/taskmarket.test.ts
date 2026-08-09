import { describe, expect, it, vi } from 'vitest'
import {
  createTaskMarketClient,
  formatTaskMarketUsdc,
  prepareTaskMarketDelegation,
  taskMarketUrl,
  type TaskMarketTask,
} from './taskmarket'

const task: TaskMarketTask = {
  createdAt: '2026-08-09T00:00:00.000Z',
  description: '# Verify an agent receipt\n\nProduce a report.',
  expiryTime: '2026-08-10T00:00:00.000Z',
  id: `0x${'a'.repeat(64)}`,
  mode: 'bounty',
  phase: 'active',
  requester: `0x${'b'.repeat(40)}`,
  requesterAgentId: 'requester-1',
  reward: '1250000',
  status: 'open',
  submissionCount: 2,
  submissionWindowOpen: true,
  tags: ['agents', 'crypto'],
}

describe('TaskMarket integration', () => {
  it('formats canonical USDC base units without floating point rounding', () => {
    expect(formatTaskMarketUsdc('0')).toBe('0')
    expect(formatTaskMarketUsdc('1250000')).toBe('1.25')
    expect(formatTaskMarketUsdc('1000001')).toBe('1.000001')
    expect(() => formatTaskMarketUsdc('1.2')).toThrow('unsigned base-unit integers')
  })

  it('builds a user-confirmation handoff without initiating a wallet action', () => {
    const draft = prepareTaskMarketDelegation(task)

    expect(draft).toEqual({
      authorizationRequired: true,
      mode: 'bounty',
      reward: '1250000',
      taskId: task.id,
      taskTitle: 'Verify an agent receipt',
      taskUrl: taskMarketUrl(task.id),
      walletAction: 'none',
    })
  })

  it('lists open tasks through the public API with bounded filters', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString())
      expect(url.pathname).toBe('/api/tasks')
      expect(url.searchParams.get('status')).toBe('open')
      expect(url.searchParams.get('minReward')).toBe('1000000')
      expect(url.searchParams.get('limit')).toBe('5')
      return new Response(JSON.stringify({ hasMore: false, nextCursor: null, tasks: [task] }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    })

    await expect(createTaskMarketClient(fetcher, 'https://api.taskmarket.dev/api').listOpenTasks({
      limit: 5,
      minReward: '1000000',
    })).resolves.toEqual([task])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('rejects malformed task data before it reaches the UI', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      hasMore: false,
      nextCursor: null,
      tasks: [{ ...task, reward: '1.5' }],
    }), { status: 200 }))

    await expect(createTaskMarketClient(fetcher).listOpenTasks()).rejects.toThrow('invalid USDC reward')
  })

  it('preserves HTTP errors for a user-visible retry path', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }))

    await expect(createTaskMarketClient(fetcher).listOpenTasks()).rejects.toMatchObject({
      message: 'rate limited',
      status: 429,
    })
  })
})
