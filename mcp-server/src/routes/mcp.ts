import { Router, Request, Response } from 'express'
import { TOOL_DEFINITIONS, invokeTool } from '../tools/registry.js'
import type { McpAuthLocals } from '../middleware/auth.js'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

router.get('/tools', (_req: Request, res: Response) => {
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
    output_schema: t.output_schema,
  }))
  res.json({ tools })
})

router.post('/call', async (req: Request, res: Response) => {
  const mcp = (res.locals as { mcp?: McpAuthLocals }).mcp
  if (!mcp) {
    res.status(401).json({ output: {}, error: { code: 'UNAUTHORIZED', message: 'Missing auth context' } })
    return
  }

  const body = req.body as { tool?: string; input?: unknown }
  const toolName = body?.tool
  const input = body?.input ?? {}

  if (!toolName || typeof toolName !== 'string') {
    res.status(400).json({
      output: {},
      error: { code: 'BAD_REQUEST', message: 'Missing or invalid "tool" in body' },
    })
    return
  }

  const start = Date.now()
  const ctx = {
    requestId: mcp.requestId,
    actorId: mcp.actorId,
    actorType: mcp.actorType,
    purpose: mcp.purpose,
    allowUnmasked: mcp.allowUnmasked,
  }

  const result = await invokeTool(toolName, input, ctx)
  const latency = Date.now() - start

  if (result.error) {
    res.status(400).json({
      output: result.output,
      error: result.error,
      meta: { request_id: mcp.requestId, latency_ms: latency },
    })
    return
  }

  res.json({
    output: result.output,
    meta: { request_id: mcp.requestId, latency_ms: latency },
  })
})

export default router
