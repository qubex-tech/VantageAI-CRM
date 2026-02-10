import { NextRequest, NextResponse } from 'next/server'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'
import { logMcpRequest } from '@/lib/mcp/request-log'

/** No auth. For load balancers and Retell to check MCP availability. */
export async function GET(request: NextRequest) {
  logMcpRequest('/mcp/health', request, { auth: 'public', status: 200 })
  return applyCors(NextResponse.json({ ok: true }), request)
}

export async function OPTIONS(request: NextRequest) {
  logMcpRequest('/mcp/health', request, { auth: 'preflight' })
  return handleCorsPreflight(request)
}
