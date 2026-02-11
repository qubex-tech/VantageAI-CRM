import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { invokeTool, TOOL_DEFINITIONS } from '@/lib/mcp/registry'
import { logMcpRequest } from '@/lib/mcp/request-log'

export const dynamic = 'force-dynamic'

function getTools() {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
    input_schema: t.input_schema,
  }))
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  }
}

export async function OPTIONS(request: NextRequest) {
  logMcpRequest('/mcp', request, { auth: 'preflight' })
  return handleCorsPreflight(request)
}

export async function POST(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    logMcpRequest('/mcp', request, { auth: auth.error.body.error.code, status: auth.error.status })
    return applyCors(NextResponse.json(auth.error.body, { status: auth.error.status }), request)
  }

  let payload: unknown = null
  try {
    const raw = await request.text()
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }

  const tools = getTools()

  // Compatibility fallback: some clients POST with no JSON-RPC method while loading tools.
  if (!payload || typeof payload !== 'object' || !('method' in payload)) {
    logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        tools,
        result: { tools },
        data: tools,
      }),
      request
    )
  }

  const rpc = payload as {
    jsonrpc?: unknown
    id?: unknown
    method?: unknown
    params?: unknown
  }

  const id = rpc.id ?? null
  const method = typeof rpc.method === 'string' ? rpc.method : ''

  if (method === 'tools/list') {
    logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { tools },
      }),
      request
    )
  }

  if (method === 'initialize') {
    logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'vantage-mcp',
            version: '1.0.0',
          },
        },
      }),
      request
    )
  }

  if (method === 'notifications/initialized') {
    logMcpRequest('/mcp', request, { auth: 'ok', status: 204 })
    return applyCors(new NextResponse(null, { status: 204 }), request)
  }

  if (method === 'ping') {
    logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {},
      }),
      request
    )
  }

  if (method === 'tools/call') {
    const params = (rpc.params ?? {}) as { name?: unknown; arguments?: unknown }
    const toolName = typeof params.name === 'string' ? params.name : ''
    if (!toolName) {
      return applyCors(NextResponse.json(jsonRpcError(id, -32602, 'Invalid params: missing tool name')), request)
    }

    const input = params.arguments ?? {}
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
      logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
      return applyCors(
        NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `${result.error.code}: ${result.error.message}` }],
            output: result.output,
            error: result.error,
            meta: { request_id: auth.ctx.requestId, latency_ms: latency },
          },
        }),
        request
      )
    }

    logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(result.output) }],
          output: result.output,
          meta: { request_id: auth.ctx.requestId, latency_ms: latency },
        },
      }),
      request
    )
  }

  logMcpRequest('/mcp', request, { auth: 'ok', status: 200 })
  return applyCors(NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`)), request)
}
