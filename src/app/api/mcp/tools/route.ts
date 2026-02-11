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

function buildToolsResponse(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    logMcpRequest('/mcp/tools', request, { auth: auth.error.body.error.code, status: auth.error.status })
    return applyCors(NextResponse.json(auth.error.body, { status: auth.error.status }), request)
  }
  logMcpRequest('/mcp/tools', request, { auth: 'ok', status: 200 })
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
  }))
  return applyCors(NextResponse.json(tools), request)
}

export async function GET(request: NextRequest) {
  return buildToolsResponse(request)
}

export async function POST(request: NextRequest) {
  return buildToolsResponse(request)
}
