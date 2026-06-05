/**
 * Structured logging for MCP endpoints (Vercel function logs).
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

export interface InsuranceFieldPassed {
  passed: boolean
  value?: string
}

export interface InsurancePassedSummary {
  payer_name?: string
  plan_name?: string
  plan_type?: string
  is_primary?: boolean
  insurer_phone?: string
  policy_id_prefix?: string
  member_id: InsuranceFieldPassed
  group_number: InsuranceFieldPassed
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
  /** Insurance fields returned or forwarded (masked where sensitive) */
  passedData?: InsurancePassedSummary
  source?: 'http' | 'in_process'
}

function truncateId(id: string | undefined | null): string | undefined {
  if (!id || typeof id !== 'string') return undefined
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function fieldPassed(...values: unknown[]): InsuranceFieldPassed {
  for (const value of values) {
    if (value == null || value === '') continue
    const s = String(value).trim()
    if (!s || s === '—') continue
    return { passed: true, value: s }
  }
  return { passed: false }
}

function insuranceFromBlock(block: unknown): InsurancePassedSummary | null {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null
  const ins = block as Record<string, unknown>
  return {
    payer_name: typeof ins.payer_name_raw === 'string' ? ins.payer_name_raw : undefined,
    plan_name: typeof ins.plan_name === 'string' ? ins.plan_name : undefined,
    plan_type: typeof ins.plan_type === 'string' ? ins.plan_type : undefined,
    is_primary: typeof ins.is_primary === 'boolean' ? ins.is_primary : undefined,
    insurer_phone:
      typeof ins.insurer_phone === 'string'
        ? ins.insurer_phone
        : typeof ins.insurerPhone === 'string'
          ? ins.insurerPhone
          : undefined,
    policy_id_prefix: truncateId(
      typeof ins.policy_id === 'string' ? ins.policy_id : undefined
    ),
    member_id: fieldPassed(ins.member_id, ins.member_id_masked, ins.memberId),
    group_number: fieldPassed(
      ins.group_number,
      ins.group_number_masked,
      ins.group_id,
      ins.groupNumber
    ),
  }
}

/** Extract insurance fields from MCP tool output or Retell payload objects. */
export function summarizeInsurancePassedData(payload: unknown): InsurancePassedSummary | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>

  const candidates: unknown[] = [
    (record.verification_bundle as Record<string, unknown> | undefined)?.insurance,
    record.insurance,
    Array.isArray(record.policies) && record.policies.length > 0
      ? (record.policies as unknown[])[0]
      : undefined,
  ]

  for (const candidate of candidates) {
    const summary = insuranceFromBlock(candidate)
    if (summary && (summary.group_number.passed || summary.member_id.passed || summary.payer_name)) {
      return summary
    }
  }

  const fallback = insuranceFromBlock(record)
  if (
    fallback &&
    (fallback.group_number.passed || fallback.member_id.passed || fallback.payer_name)
  ) {
    return fallback
  }
  return undefined
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
  passedData?: InsurancePassedSummary
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
    passedData: summarizeInsurancePassedData(output),
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

/** Log insurance fields sent to Retell (e.g. dynamic variables). */
export function logRetellInsurancePassed(params: {
  route: string
  retellCallId?: string | null
  patientIdPrefix?: string
  policyIdPrefix?: string
  verificationBundle?: unknown
  contextPolicy?: unknown
}): void {
  const fromBundle = summarizeInsurancePassedData({
    verification_bundle: params.verificationBundle,
    insurance: params.contextPolicy,
  })
  console.log(
    `[MCP] retell_passed ${JSON.stringify({
      event: 'retell_insurance_passed',
      ts: new Date().toISOString(),
      route: params.route,
      retellCallId: params.retellCallId ?? null,
      patientIdPrefix: params.patientIdPrefix,
      policyIdPrefix: params.policyIdPrefix,
      passedData: fromBundle ?? {
        member_id: { passed: false },
        group_number: { passed: false },
      },
    })}`
  )
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
    passedData: outputSummary.passedData,
    source: params.source,
  }
}
