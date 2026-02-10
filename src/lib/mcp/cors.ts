/**
 * CORS support for MCP API routes.
 * Allows browser-based MCP clients (e.g. Retell dashboard) to call the API.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = (process.env.MCP_CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean)

const MCP_HEADERS = [
  'X-API-Key',
  'X-Actor-Id',
  'X-Actor-Type',
  'X-Purpose',
  'X-Request-Id',
  'X-Allow-Unmasked',
  'Content-Type',
]

const MCP_METHODS = 'GET, POST, OPTIONS'

/** Determine Access-Control-Allow-Origin from request Origin */
function resolveAllowOrigin(origin: string | null): string {
  if (ALLOWED_ORIGINS.length === 0) return '*'
  if (!origin) return '*'
  const o = origin.toLowerCase().trim()
  return ALLOWED_ORIGINS.includes(o) ? origin : '*'
}

/** Build CORS headers for a response */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowOrigin(origin),
    'Access-Control-Allow-Methods': MCP_METHODS,
    'Access-Control-Allow-Headers': MCP_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
  }
}

/** Handle OPTIONS preflight */
export function handleCorsPreflight(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)
  return new NextResponse(null, { status: 204, headers })
}

/** Add CORS headers to any response */
export function applyCors<T>(
  response: NextResponse<T>,
  request: NextRequest
): NextResponse<T> {
  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}
