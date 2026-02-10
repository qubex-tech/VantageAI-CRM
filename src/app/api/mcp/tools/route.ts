import { NextRequest, NextResponse } from 'next/server'
import { validateMcpHeaders } from '@/lib/mcp/auth'
import { TOOL_DEFINITIONS } from '@/lib/mcp/registry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = validateMcpHeaders(request.headers)
  if (!auth.ok) {
    return NextResponse.json(auth.error.body, { status: auth.error.status })
  }
  // Retell Get MCP Tools expects a top-level array with inputSchema (camelCase)
  const tools = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
  }))
  return NextResponse.json(tools)
}
