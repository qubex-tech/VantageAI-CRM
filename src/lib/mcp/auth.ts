/**
 * MCP request auth: validate X-API-Key, X-Actor-Id, X-Actor-Type, X-Purpose, X-Request-Id.
 *
 * Tenant scoping: a request is bound to a single practice via either
 *  - a per-practice API key (MCP_PRACTICE_API_KEYS = JSON map of key -> practiceId), or
 *  - an X-Practice-Id header (allowed for legacy shared keys in MCP_API_KEYS).
 * When MCP_REQUIRE_PRACTICE_SCOPE=true, requests without a resolvable practice
 * are rejected so no tool can read across practices.
 */
const MCP_API_KEYS = (process.env.MCP_API_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)

/** Optional JSON map of `{ "<apiKey>": "<practiceId>" }` for hard per-practice binding. */
const MCP_PRACTICE_API_KEYS: Record<string, string> = (() => {
  const raw = process.env.MCP_PRACTICE_API_KEYS
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim()) {
        out[key.trim()] = value.trim()
      }
    }
    return out
  } catch {
    return {}
  }
})()

const REQUIRE_PRACTICE_SCOPE = process.env.MCP_REQUIRE_PRACTICE_SCOPE === 'true'

const ALLOW_AGENT_UNMASKED = process.env.ALLOW_AGENT_UNMASKED === 'true'
const REQUIRED_PURPOSE = 'insurance_verification'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ActorType = 'agent' | 'user' | 'system'

export interface McpAuthResult {
  actorId: string
  actorType: ActorType
  purpose: string
  requestId: string
  allowUnmasked: boolean
  /** Practice this request is scoped to; null when unscoped (legacy shared key, no header). */
  practiceId: string | null
}

export interface McpAuthError {
  status: 401 | 400
  body: { error: { code: string; message: string } }
}

export function validateMcpHeaders(headers: Headers): { ok: true; ctx: McpAuthResult } | { ok: false; error: McpAuthError } {
  const apiKey = headers.get('x-api-key')
  const mappedPractice = apiKey ? MCP_PRACTICE_API_KEYS[apiKey] : undefined
  const isLegacyKey = !!apiKey && MCP_API_KEYS.includes(apiKey)
  if (!apiKey || (!mappedPractice && !isLegacyKey)) {
    return { ok: false, error: { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } } } }
  }

  const actorId = headers.get('x-actor-id')?.trim()
  const actorType = headers.get('x-actor-type') as ActorType | null
  const purpose = headers.get('x-purpose')
  const requestId = headers.get('x-request-id')
  const allowUnmaskedHeader = headers.get('x-allow-unmasked') === 'true'

  if (!actorId) {
    return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Missing X-Actor-Id' } } } }
  }
  if (!actorType || !['agent', 'user', 'system'].includes(actorType)) {
    return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'X-Actor-Type must be agent, user, or system' } } } }
  }
  if (purpose !== REQUIRED_PURPOSE) {
    return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: `X-Purpose must be "${REQUIRED_PURPOSE}"` } } } }
  }
  if (!requestId || !UUID_REGEX.test(requestId)) {
    return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'X-Request-Id must be a valid UUID' } } } }
  }

  // Resolve the practice this request is scoped to.
  const headerPractice = headers.get('x-practice-id')?.trim() || null
  let practiceId: string | null
  if (mappedPractice) {
    // Per-practice key: bind to its practice; reject a conflicting header.
    if (headerPractice && headerPractice !== mappedPractice) {
      return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'X-Practice-Id does not match API key' } } } }
    }
    practiceId = mappedPractice
  } else {
    // Legacy shared key: optional header-based scoping.
    practiceId = headerPractice
  }
  if (REQUIRE_PRACTICE_SCOPE && !practiceId) {
    return { ok: false, error: { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Missing practice scope: provide X-Practice-Id or use a per-practice API key' } } } }
  }

  // Insurance verification MCP always returns full member/group/plan values.
  const allowUnmasked =
    purpose === REQUIRED_PURPOSE ||
    (allowUnmaskedHeader && (actorType !== 'agent' || ALLOW_AGENT_UNMASKED))
  return {
    ok: true,
    ctx: { actorId, actorType, purpose, requestId, allowUnmasked, practiceId },
  }
}
