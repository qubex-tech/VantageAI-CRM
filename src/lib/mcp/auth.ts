/**
 * MCP request auth: validate X-API-Key, X-Actor-Id, X-Actor-Type, X-Purpose, X-Request-Id.
 */
const MCP_API_KEYS = (process.env.MCP_API_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)

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
}

export interface McpAuthError {
  status: 401 | 400
  body: { error: { code: string; message: string } }
}

export function validateMcpHeaders(headers: Headers): { ok: true; ctx: McpAuthResult } | { ok: false; error: McpAuthError } {
  const apiKey = headers.get('x-api-key')
  if (!apiKey || !MCP_API_KEYS.includes(apiKey)) {
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

  const allowUnmasked = allowUnmaskedHeader && (actorType !== 'agent' || ALLOW_AGENT_UNMASKED)
  return {
    ok: true,
    ctx: { actorId, actorType, purpose, requestId, allowUnmasked },
  }
}
