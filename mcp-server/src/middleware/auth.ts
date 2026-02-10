import type { Request, Response, NextFunction } from 'express'

const MCP_API_KEYS = (process.env.MCP_API_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)

const ALLOW_AGENT_UNMASKED = process.env.ALLOW_AGENT_UNMASKED === 'true'
const REQUIRED_PURPOSE = 'insurance_verification'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ActorType = 'agent' | 'user' | 'system'

export interface McpAuthLocals {
  actorId: string
  actorType: ActorType
  purpose: string
  requestId: string
  allowUnmasked: boolean
}

export function requireMcpAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined
  if (!apiKey || !MCP_API_KEYS.includes(apiKey)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } })
    return
  }

  const actorId = req.headers['x-actor-id'] as string | undefined
  const actorType = req.headers['x-actor-type'] as ActorType | undefined
  const purpose = req.headers['x-purpose'] as string | undefined
  const requestId = req.headers['x-request-id'] as string | undefined
  const allowUnmaskedHeader = (req.headers['x-allow-unmasked'] as string) === 'true'

  if (!actorId?.trim()) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing X-Actor-Id' } })
    return
  }
  if (!actorType || !['agent', 'user', 'system'].includes(actorType)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'X-Actor-Type must be agent, user, or system' } })
    return
  }
  if (purpose !== REQUIRED_PURPOSE) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: `X-Purpose must be "${REQUIRED_PURPOSE}"`,
      },
    })
    return
  }
  if (!requestId || !UUID_REGEX.test(requestId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'X-Request-Id must be a valid UUID' } })
    return
  }

  const allowUnmasked =
    allowUnmaskedHeader &&
    (actorType !== 'agent' || ALLOW_AGENT_UNMASKED)

  ;(res.locals as { mcp?: McpAuthLocals }).mcp = {
    actorId: actorId.trim(),
    actorType,
    purpose,
    requestId,
    allowUnmasked,
  }
  next()
}
