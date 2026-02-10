import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { TOOL_DEFINITIONS } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request)
}

export async function GET(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    return applyCors(NextResponse.json(auth.error.body, { status: auth.error.status }), request)
  }
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
  }))
  return applyCors(NextResponse.json(tools), request)
}
