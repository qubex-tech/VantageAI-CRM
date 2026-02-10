import { NextResponse } from 'next/server'

/** No auth. For load balancers and Retell to check MCP availability. */
export async function GET() {
  return NextResponse.json({ ok: true })
}
