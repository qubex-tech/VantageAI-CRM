import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { invokeTool } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    return NextResponse.json(auth.error.body, { status: auth.error.status })
  }

  let body: { tool?: string; input?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { output: {}, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const toolName = body?.tool
  const input = body?.input ?? {}

  if (!toolName || typeof toolName !== 'string') {
    return NextResponse.json(
      { output: {}, error: { code: 'BAD_REQUEST', message: 'Missing or invalid "tool" in body' } },
      { status: 400 }
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
    return NextResponse.json(
      {
        output: result.output,
        error: result.error,
        meta: { request_id: auth.ctx.requestId, latency_ms: latency },
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    output: result.output,
    meta: { request_id: auth.ctx.requestId, latency_ms: latency },
  })
}
