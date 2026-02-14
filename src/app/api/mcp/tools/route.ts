import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { logMcpRequest } from '@/lib/mcp/request-log'
import { invokeTool, TOOL_DEFINITIONS } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: NextRequest) {
  logMcpRequest('/mcp/tools', request, { auth: 'preflight' })
  return handleCorsPreflight(request)
}

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

function normalizeNullableArgs(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(normalizeNullableArgs)
  }
  if (input && typeof input === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (value === null) continue
      next[key] = normalizeNullableArgs(value)
    }
    return next
  }
  return input
}

function validateToolsAuth(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    logMcpRequest('/mcp/tools', request, { auth: auth.error.body.error.code, status: auth.error.status })
    return { ok: false as const, response: applyCors(NextResponse.json(auth.error.body, { status: auth.error.status }), request) }
  }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = validateToolsAuth(request)
  if (!auth.ok) return auth.response

  logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
  return applyCors(NextResponse.json(getTools()), request)
}

export async function POST(request: NextRequest) {
  const auth = validateToolsAuth(request)
  if (!auth.ok) return auth.response

  let payload: unknown = null
  try {
    const raw = await request.text()
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }

  const tools = getTools()
  const rpc = (payload ?? {}) as {
    id?: unknown
    method?: unknown
    params?: unknown
  }
  const id = rpc.id ?? null
  const method = typeof rpc.method === "string" ? rpc.method : ''

  if (method === 'tools/list') {
    logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { tools },
      }),
      request
    )
  }

  // Support full JSON-RPC tool invocation even when clients are configured to /mcp/tools.
  if (method === 'tools/call') {
    const params = (rpc.params ?? {}) as { name?: unknown; arguments?: unknown }
    const toolName = typeof params.name === 'string' ? params.name : ''
    if (!toolName) {
      return applyCors(NextResponse.json(jsonRpcError(id, -32602, 'Invalid params: missing tool name')), request)
    }

    let input: unknown = params.arguments ?? {}
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input)
      } catch {
        return applyCors(
          NextResponse.json(jsonRpcError(id, -32602, 'Invalid params: arguments must be valid JSON object')),
          request
        )
      }
    }
    input = normalizeNullableArgs(input)

    const start = Date.now()
    const result = await invokeTool(toolName, input, {
      requestId: auth.ok ? request.headers.get('x-request-id') || '' : '',
      actorId: request.headers.get('x-actor-id') || '',
      actorType: (request.headers.get('x-actor-type') as 'agent' | 'user' | 'system') || 'agent',
      purpose: request.headers.get('x-purpose') || '',
      allowUnmasked: request.headers.get('x-allow-unmasked') === 'true',
    })
    const latency = Date.now() - start

    if (result.error) {
      logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
      const errorPayload = {
        error: result.error,
        output: result.output,
        meta: { request_id: request.headers.get('x-request-id') || null, latency_ms: latency },
      }
      return applyCors(
        NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify(errorPayload) }],
            output: result.output,
            error: result.error,
            meta: { request_id: request.headers.get('x-request-id') || null, latency_ms: latency },
          },
        }),
        request
      )
    }

    logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify(result.output) }],
          output: result.output,
          meta: { request_id: request.headers.get('x-request-id') || null, latency_ms: latency },
        },
      }),
      request
    )
  }

  if (method === 'initialize') {
    logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
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
    logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id: null,
        result: {},
      }),
      request
    )
  }

  if (method === 'ping') {
    logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
    return applyCors(
      NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {},
      }),
      request
    )
  }

  // Compatibility fallback for clients posting a non-JSON-RPC tools request.
  // Include common shapes used by different MCP integrations.
  logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
  if (method) {
    return applyCors(NextResponse.json(jsonRpcError(id, -32601, `Method not found: ${method}`)), request)
  }
  return applyCors(
    NextResponse.json({
      tools,
      result: { tools },
      data: tools,
    }),
    request
  )
}
