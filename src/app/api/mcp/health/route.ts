import { NextRequest, NextResponse } from 'next/server'
import { applyCors, handleCorsPreflight } from '@/lib/mcp/cors'

/** No auth. For load balancers and Retell to check MCP availability. */
export async function GET(request: NextRequest) {
  return applyCors(NextResponse.json({ ok: true }), request)
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request)
}
