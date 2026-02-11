import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { logMcpRequest } from '@/lib/mcp/request-log'
import { TOOL_DEFINITIONS } from '@/lib/mcp/registry'

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

  // Support MCP JSON-RPC tools/list for clients posting a unified MCP request body.
  if (
    payload &&
    typeof payload === 'object' &&
    'jsonrpc' in payload &&
    'method' in payload &&
    (payload as { method?: unknown }).method === 'tools/list'
  ) {
    const id = (payload as { id?: unknown }).id ?? null
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

  // Compatibility fallback for clients posting a non-JSON-RPC tools request.
  // Include common shapes used by different MCP integrations.
  logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
  return applyCors(
    NextResponse.json({
      tools,
      result: { tools },
      data: tools,
    }),
    request
  )
}
