import * as schemas from './schemas'
import * as handlers from './handlers'
import type { RequestContext } from './handlers'
import { buildToolLogFromInvocation, logMcpToolCall } from './request-log'

export const TOOL_DEFINITIONS = [
  {
    name: 'resolve_patient_for_scheduling',
    description:
      'Resolve or create a patient for scheduling. Always returns ground-truth facts: caller demographics, CRM chart, linked Open Dental chart (PatNum, name, DOB), phone collisions, identity_match, and recommendation. Phone numbers are NOT unique — family members may share one. When the caller first+last name differs from the chart on that phone, a new patient is created automatically (force_create is optional/legacy).',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        dob: { type: 'string', description: 'YYYY-MM-DD or MM/DD/YYYY — year is required' },
        name: { type: 'string' },
        email: { type: 'string' },
        force_create: { type: 'boolean', default: false },
      },
      description: 'Provide phone and caller demographics. Call before find_or_create_patient or book_appointment.',
    },
    inputSchema: schemas.resolvePatientForSchedulingInput,
    handler: handlers.handleResolvePatientForScheduling,
  },
  {
    name: 'get_insurance_verification_context',
    description:
      'Single-call tool: resolve patient and return verification fields for the voice agent: patient_first_name, patient_last_name, patient_dob (YYYY-MM-DD), member_id, group_number.',
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string', format: 'uuid' },
        policy_id: { type: 'string', format: 'uuid' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        dob: { type: 'string' },
        zip: { type: 'string' },
        include_address: { type: 'boolean', default: true },
        include_rx: { type: 'boolean', default: true },
        strict_minimum_necessary: { type: 'boolean', default: true },
      },
      description: 'Provide patient_id OR policy_id OR first_name+last_name+dob',
    },
    inputSchema: schemas.getInsuranceVerificationContextInput,
    handler: handlers.handleGetInsuranceVerificationContext,
  },
  {
    name: 'get_patient_identity',
    description: 'Get patient identity and optionally address. Minimum necessary for verification.',
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string', format: 'uuid' },
        include_address: { type: 'boolean', default: false },
      },
      required: ['patient_id'],
    },
    inputSchema: schemas.getPatientIdentityInput,
    handler: handlers.handleGetPatientIdentity,
  },
  {
    name: 'list_insurance_policies',
    description: 'List insurance policies for a patient. Returns payer, member ID, group number, plan name, and completeness.',
    input_schema: {
      type: 'object',
      properties: { patient_id: { type: 'string', format: 'uuid' } },
      required: ['patient_id'],
    },
    inputSchema: schemas.listInsurancePoliciesInput,
    handler: handlers.handleListInsurancePolicies,
  },
  {
    name: 'get_insurance_policy_details',
    description: 'Get full policy details: payer, member ID, group number, plan name, subscriber, BCBS routing, optional Rx and card refs.',
    input_schema: {
      type: 'object',
      properties: {
        policy_id: { type: 'string', format: 'uuid' },
        include_rx: { type: 'boolean', default: false },
        include_card_refs: { type: 'boolean', default: false },
      },
      required: ['policy_id'],
    },
    inputSchema: schemas.getInsurancePolicyDetailsInput,
    handler: handlers.handleGetInsurancePolicyDetails,
  },
  {
    name: 'get_verification_bundle',
    description:
      'Get the verification bundle with agent template fields: patient_first_name, patient_last_name, patient_dob (YYYY-MM-DD), member_id, group_number.',
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string', format: 'uuid' },
        policy_id: { type: 'string', format: 'uuid' },
        include_address: { type: 'boolean', default: false },
        include_rx: { type: 'boolean', default: false },
        strict_minimum_necessary: { type: 'boolean', default: true },
      },
      required: ['patient_id'],
    },
    inputSchema: schemas.getVerificationBundleInput,
    handler: handlers.handleGetVerificationBundle,
  },
  {
    name: 'search_patient_by_demographics',
    description: 'Search for patients by first name, last name, date of birth, and optional ZIP. Returns matches with masked display.',
    input_schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        dob: { type: 'string' },
        zip: { type: 'string' },
      },
      required: ['first_name', 'last_name', 'dob'],
    },
    inputSchema: schemas.searchPatientByDemographicsInput,
    handler: handlers.handleSearchPatientByDemographics,
  },
  {
    name: 'get_upcoming_appointments',
    description:
      "Get a patient's upcoming (scheduled/confirmed) appointments, ordered soonest-first. On Open Dental practices this live-pulls the patient's OD appointments before responding so the agent uses current schedule data, not a stale CRM mirror. Each appointment includes a ready-to-read summary with the date and time in the patient's local timezone, chairside notes when available, plus next_appointment for convenience. Resolve the patient with patient_id, or with first_name + last_name + dob during a live call.",
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string', format: 'uuid' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        dob: { type: 'string' },
        zip: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      },
      description: 'Provide patient_id OR first_name + last_name + dob',
    },
    inputSchema: schemas.getUpcomingAppointmentsInput,
    handler: handlers.handleGetUpcomingAppointments,
  },
] as const

const toolMap = new Map<string, (typeof TOOL_DEFINITIONS)[number]>(
  TOOL_DEFINITIONS.map((t) => [t.name, t])
)

export async function invokeTool(
  toolName: string,
  input: unknown,
  ctx: RequestContext & { logRoute?: string; logSource?: 'http' | 'in_process' }
): Promise<{ output: object; error?: { code: string; message: string } }> {
  const logRoute = ctx.logRoute ?? 'invoke'
  const logSource = ctx.logSource ?? 'in_process'
  const started = Date.now()

  const finish = (
    output: object,
    invokeError?: { code: string; message: string }
  ): { output: object; error?: { code: string; message: string } } => {
    logMcpToolCall(
      buildToolLogFromInvocation({
        route: logRoute,
        tool: toolName,
        input,
        output,
        ctx,
        latencyMs: Date.now() - started,
        invokeError,
        source: logSource,
      })
    )
    return invokeError ? { output, error: invokeError } : { output }
  }

  const tool = toolMap.get(toolName)
  if (!tool) {
    return finish({}, { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` })
  }
  const parsed = tool.inputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const msg = Object.entries(fieldErrors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
      .join('; ')
    return finish({}, { code: 'VALIDATION_ERROR', message: msg })
  }
  try {
    const result = await (tool.handler as (input: unknown, ctx: RequestContext) => Promise<{ output: object }>)(
      parsed.data,
      ctx
    )
    return finish(result.output)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return finish({}, { code: 'EXECUTION_ERROR', message })
  }
}
