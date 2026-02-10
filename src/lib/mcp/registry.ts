import * as schemas from './schemas'
import * as handlers from './handlers'
import type { RequestContext } from './handlers'

export const TOOL_DEFINITIONS = [
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
    description: 'List insurance policies for a patient. Returns payer, primary flag, masked member ID, completeness.',
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
    description: 'Get full policy details: payer, member/group (masked by default), subscriber, BCBS routing, optional Rx and card refs.',
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
    description: 'Get the complete minimal verification bundle for a patient and policy (or primary policy). Use for eligibility/verification workflows.',
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
] as const

const toolMap = new Map<string, (typeof TOOL_DEFINITIONS)[number]>(
  TOOL_DEFINITIONS.map((t) => [t.name, t])
)

export async function invokeTool(
  toolName: string,
  input: unknown,
  ctx: RequestContext
): Promise<{ output: object; error?: { code: string; message: string } }> {
  const tool = toolMap.get(toolName)
  if (!tool) {
    return { output: {}, error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` } }
  }
  const parsed = tool.inputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const msg = Object.entries(fieldErrors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
      .join('; ')
    return { output: {}, error: { code: 'VALIDATION_ERROR', message: msg } }
  }
  try {
    const result = await (tool.handler as (input: unknown, ctx: RequestContext) => Promise<{ output: object }>)(
      parsed.data,
      ctx
    )
    return { output: result.output }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return { output: {}, error: { code: 'EXECUTION_ERROR', message } }
  }
}
