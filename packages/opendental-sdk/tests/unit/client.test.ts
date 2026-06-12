import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildAuthorizationHeader } from '../../src/auth/authorization'
import { OpenDentalClient } from '../../src/client/OpenDentalClient'
import { resetRateLimitState } from '../../src/client/retry'
import { TEST_CREDENTIALS } from '../../src/auth/credentials'
import { AuthenticationError, RateLimitError } from '../../src/errors'
import { PracticeRegistry } from '../../src/practice/PracticeRegistry'
import { toPracticeContext } from '../../src/practice/types'

describe('OpenDentalClient', () => {
  beforeEach(() => {
    resetRateLimitState()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends ODFHIR authorization header', async () => {
    const mockFetch = vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ ClinicNum: 1 }]), { status: 200 })
    )

    const client = new OpenDentalClient({
      credentials: TEST_CREDENTIALS,
      baseUrl: 'https://api.opendental.com/api/v1',
      maxRetries: 0,
    })

    await client.request('GET', 'clinics', { skipRetry: true })

    expect(mockFetch).toHaveBeenCalled()
    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: buildAuthorizationHeader(TEST_CREDENTIALS),
    })
  })

  it('maps 401 to AuthenticationError', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Unauthorized', { status: 401 }))

    const client = new OpenDentalClient({
      credentials: TEST_CREDENTIALS,
      baseUrl: 'https://api.opendental.com/api/v1',
      maxRetries: 0,
    })

    await expect(client.get('clinics')).rejects.toBeInstanceOf(AuthenticationError)
  })

  it('maps 429 to RateLimitError', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Too Many Requests', { status: 429, headers: { 'retry-after': '2' } })
    )

    const client = new OpenDentalClient({
      credentials: TEST_CREDENTIALS,
      baseUrl: 'https://api.opendental.com/api/v1',
      maxRetries: 0,
    })

    await expect(client.get('clinics')).rejects.toBeInstanceOf(RateLimitError)
  })
})

describe('PracticeRegistry', () => {
  it('isolates practice contexts by practiceId', () => {
    const registry = new PracticeRegistry()
    const ctxA = toPracticeContext({
      practiceId: 'practice-a',
      connectionId: 'conn-a',
      displayName: 'Practice A',
      customerKey: 'key-a',
      developerKey: 'dev-key',
    })
    const ctxB = toPracticeContext({
      practiceId: 'practice-b',
      connectionId: 'conn-b',
      displayName: 'Practice B',
      customerKey: 'key-b',
      developerKey: 'dev-key',
    })

    registry.register(ctxA)
    registry.register(ctxB)

    expect(registry.get('practice-a')?.credentials.customerKey).toBe('key-a')
    expect(registry.get('practice-b')?.credentials.customerKey).toBe('key-b')
    expect(registry.get('practice-a')?.credentials.customerKey).not.toBe('key-b')
  })
})

describe('capability matrix', () => {
  it('loads operations from JSON', async () => {
    const matrix = await import('../../src/capability-matrix.json')
    expect(matrix.totalOperations).toBeGreaterThan(200)
    expect(matrix.resources.length).toBeGreaterThan(80)
  })
})
