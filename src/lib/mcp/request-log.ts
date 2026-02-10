/**
 * Lightweight request logging for MCP endpoints.
 * Logs appear in Vercel function logs for debugging (e.g. Retell calls).
 */
import type { NextRequest } from 'next/server'

export function logMcpRequest(
  route: string,
  request: NextRequest,
  meta: { auth?: 'ok' | string; status?: number }
): void {
  const origin = request.headers.get('origin') ?? '-'
  const actorId = request.headers.get('x-actor-id') ?? '-'
  const auth = meta.auth ?? '-'
  const status = meta.status ?? '-'
  const ts = new Date().toISOString()
  console.log(`[MCP] ${route} ${request.method} origin=${origin} x-actor-id=${actorId} auth=${auth} status=${status} ts=${ts}`)
}
