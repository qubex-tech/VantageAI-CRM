import { z } from 'zod'
import type { RheumEligibilityPacket } from '@/lib/eligibility/rheum-packet'
import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  type EligibilityFormMode,
} from '@/lib/eligibility/rheum-packet'

/** Structured fields Stagehand extract should return from Availity results. */
export const availityResultExtractSchema = z.object({
  memberStatus: z.string().optional().nullable(),
  networkStatus: z.enum(['inn', 'onn', 'unknown']).optional().nullable(),
  planType: z.string().optional().nullable(),
  specialistCopay: z.string().optional().nullable(),
  coinsurance: z.string().optional().nullable(),
  limitations: z.string().optional().nullable(),
  authRequired: z.boolean().optional().nullable(),
  referralRequired: z.boolean().optional().nullable(),
  telehealthAllowed: z.boolean().optional().nullable(),
  deductible: z
    .object({
      total: z.string().optional().nullable(),
      met: z.string().optional().nullable(),
      remaining: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  oop: z
    .object({
      max: z.string().optional().nullable(),
      met: z.string().optional().nullable(),
      remaining: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export type AvailityResultExtract = z.infer<typeof availityResultExtractSchema>

function pickMoney(
  primary?: string | null,
  fallback?: string | null
): string | undefined {
  const v = (primary || fallback || '').trim()
  return v || undefined
}

/** Map Stagehand extract output into a rheum packet (optionally merging heuristic scrape). */
export function mapExtractToRheumPacket(
  extracted: AvailityResultExtract | null | undefined,
  opts?: {
    formMode?: EligibilityFormMode
    heuristic?: RheumEligibilityPacket | null
  }
): RheumEligibilityPacket {
  const formMode = opts?.formMode || 'office_visit'
  const base = opts?.heuristic
    ? { ...opts.heuristic }
    : createEmptyRheumPacket(formMode, 'availity_rpa')

  if (!extracted) return finalizeRheumPacket(base)

  if (extracted.memberStatus) base.memberStatus = extracted.memberStatus
  if (extracted.networkStatus && extracted.networkStatus !== 'unknown') {
    base.networkStatus = extracted.networkStatus
  } else if (extracted.networkStatus === 'unknown' && !base.networkStatus) {
    base.networkStatus = 'unknown'
  }
  if (extracted.planType) base.planType = extracted.planType
  if (extracted.specialistCopay) base.specialistCopay = extracted.specialistCopay
  if (extracted.coinsurance) base.coinsurance = extracted.coinsurance
  if (extracted.limitations) base.limitations = extracted.limitations
  if (extracted.authRequired != null) base.authRequired = extracted.authRequired
  if (extracted.referralRequired != null) base.referralRequired = extracted.referralRequired
  if (extracted.telehealthAllowed != null) base.telehealthAllowed = extracted.telehealthAllowed

  if (extracted.deductible) {
    base.deductible = {
      total: pickMoney(extracted.deductible.total, base.deductible?.total),
      met: pickMoney(extracted.deductible.met, base.deductible?.met),
      remaining: pickMoney(extracted.deductible.remaining, base.deductible?.remaining),
    }
  }
  if (extracted.oop) {
    base.oop = {
      max: pickMoney(extracted.oop.max, base.oop?.max),
      met: pickMoney(extracted.oop.met, base.oop?.met),
      remaining: pickMoney(extracted.oop.remaining, base.oop?.remaining),
    }
  }

  base.source = 'availity_rpa'
  base.verifiedBy = base.verifiedBy || 'Availity portal (LLM assist)'
  return finalizeRheumPacket(base)
}

export const AVAILITY_RESULT_EXTRACT_INSTRUCTION = `
Extract Lonestar rheumatology eligibility fields from this Availity Eligibility & Benefits result page.
Prefer In Network values when both In Network and Out of Network are shown.
Read Plan Maximums / Deductibles AND Benefit Information for Professional (Physician) Visit - Office - 98.
Return:
- memberStatus (e.g. Active Coverage)
- networkStatus: inn | onn | unknown
- planType: PPO, HMO, EPO, POS, Commercial, etc. from Health Benefit Plan Coverage when present
- specialistCopay, coinsurance, limitations, authRequired
- deductible and oop with total/max, met (year to date), and remaining amounts as money strings
`.trim()
