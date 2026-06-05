/**
 * Structured logging for MCP endpoints (Vercel function logs).
 * Never log PHI values — only ids (truncated), keys, codes, and counts.
 */
import type { NextRequest } from 'next/server'
import { collectFieldPaths } from './audit'

export type McpLogAuth = 'ok' | 'public' | 'preflight' | string

export interface McpRequestLogMeta {
  auth?: McpLogAuth
  status?: number
  method?: string
  jsonRpcMethod?: string
}

export interface McpToolLogMeta {
  route: string
  tool: string
  requestId: string
  actorId: string
  actorType: string
  latencyMs: number
  outcome: 'ok' | 'validation_error' | 'unknown_tool' | 'execution_error' | 'domain_error'
  errorCode?: string
  inputKeys?: string[]
  patientIdPrefix?: string
  policyIdPrefix?: string
  fieldPathCount?: number
  hasVerificationBundle?: boolean
  source?: 'http' | 'in_process'
}

function truncateId(id: string | undefined | null): string | undefined {
  if (!id || typeof id !== 'string') return undefined
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function summarizeInputKeys(input: unknown): {
  inputKeys: string[]
  patientIdPrefix?: string
  policyIdPrefix?: string
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { inputKeys: [] }
  }
  const record = input as Record<string, unknown>
  return {
    inputKeys: Object.keys(record),
    patientIdPrefix: truncateId(
      typeof record.patient_id === 'string' ? record.patient_id : undefined
    ),
    policyIdPrefix: truncateId(
      typeof record.policy_id === 'string' ? record.policy_id : undefined
    ),
  }
}

export function summarizeMcpToolOutput(output: object): {
  fieldPathCount: number
  hasVerificationBundle: boolean
  domainErrorCode?: string
  topLevelKeys: string[]
} {
  const record = output as Record<string, unknown>
  const paths = collectFieldPaths(output)
  const domainError =
    record.error && typeof record.error === 'object'
      ? ((record.error as Record<string, unknown>).code as string | undefined)
      : undefined
  return {
    fieldPathCount: paths.length,
    hasVerificationBundle: paths.some((p) => p.startsWith('verification_bundle')),
    domainErrorCode: domainError,
    topLevelKeys: Object.keys(record),
  }
}

export function logMcpRequest(
  route: string,
  request: NextRequest,
  meta: McpRequestLogMeta
): void {
  const origin = request.headers.get('origin') ?? '-'
  const actorId = request.headers.get('x-actor-id') ?? '-'
  const actorType = request.headers.get('x-actor-type') ?? '-'
  const requestId = request.headers.get('x-request-id') ?? '-'
  const auth = meta.auth ?? '-'
  const status = meta.status ?? '-'
  const jsonRpcMethod = meta.jsonRpcMethod ?? '-'
  const ts = new Date().toISOString()
  console.log(
    `[MCP] request route=${route} http=${request.method} origin=${origin} actorType=${actorType} actorId=${actorId} requestId=${requestId} auth=${auth} status=${status} jsonrpc=${jsonRpcMethod} ts=${ts}`
  )
}

/** Log tool invocation result for Vercel (filter logs with `[MCP] tool`). */
export function logMcpToolCall(meta: McpToolLogMeta): void {
  const payload = {
    event: 'mcp_tool_call',
    ts: new Date().toISOString(),
    ...meta,
  }
  console.log(`[MCP] tool ${JSON.stringify(payload)}`)
}

export function buildToolLogFromInvocation(params: {
  route: string
  tool: string
  input: unknown
  output: object
  ctx: { requestId: string; actorId: string; actorType: string }
  latencyMs: number
  invokeError?: { code: string; message: string }
  source?: 'http' | 'in_process'
}): McpToolLogMeta {
  const inputSummary = summarizeInputKeys(params.input)
  const outputSummary = summarizeMcpToolOutput(params.output)

  let outcome: McpToolLogMeta['outcome'] = 'ok'
  let errorCode: string | undefined

  if (params.invokeError) {
    outcome =
      params.invokeError.code === 'VALIDATION_ERROR'
        ? 'validation_error'
        : params.invokeError.code === 'UNKNOWN_TOOL'
          ? 'unknown_tool'
          : 'execution_error'
    errorCode = params.invokeError.code
  } else if (outputSummary.domainErrorCode) {
    outcome = 'domain_error'
    errorCode = outputSummary.domainErrorCode
  }

  return {
    route: params.route,
    tool: params.tool,
    requestId: params.ctx.requestId,
    actorId: params.ctx.actorId,
    actorType: params.ctx.actorType,
    latencyMs: params.latencyMs,
    outcome,
    errorCode,
    inputKeys: inputSummary.inputKeys,
    patientIdPrefix: inputSummary.patientIdPrefix,
    policyIdPrefix: inputSummary.policyIdPrefix,
    fieldPathCount: outputSummary.fieldPathCount,
    hasVerificationBundle: outputSummary.hasVerificationBundle,
    source: params.source,
  }
}
