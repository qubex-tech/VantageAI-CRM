import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { invokeTool } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request)
}

export async function POST(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    return applyCors(NextResponse.json(auth.error.body, { status: auth.error.status }), request)
  }

  let body: { tool?: string; input?: unknown }
  try {
    body = await request.json()
  } catch {
    return applyCors(
      NextResponse.json(
        { output: {}, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
        { status: 400 }
      ),
      request
    )
  }

  const toolName = body?.tool
  const input = body?.input ?? {}

  if (!toolName || typeof toolName !== 'string') {
    return applyCors(
      NextResponse.json(
        { output: {}, error: { code: 'BAD_REQUEST', message: 'Missing or invalid "tool" in body' } },
        { status: 400 }
      ),
      request
    )
  }

  const start = Date.now()
  const result = await invokeTool(toolName, input, {
    requestId: auth.ctx.requestId,
    actorId: auth.ctx.actorId,
    actorType: auth.ctx.actorType,
    purpose: auth.ctx.purpose,
    allowUnmasked: auth.ctx.allowUnmasked,
  })
  const latency = Date.now() - start

  if (result.error) {
    return applyCors(
      NextResponse.json(
        {
          output: result.output,
          error: result.error,
          meta: { request_id: auth.ctx.requestId, latency_ms: latency },
        },
        { status: 400 }
      ),
      request
    )
  }

  return applyCors(
    NextResponse.json({
      output: result.output,
      meta: { request_id: auth.ctx.requestId, latency_ms: latency },
    }),
    request
  )
}
