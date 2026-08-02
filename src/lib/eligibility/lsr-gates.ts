import {
  createEmptyRheumPacket,
  finalizeRheumPacket,
  type EligibilityFormMode,
  type RheumEligibilityPacket,
} from './rheum-packet'

/**
 * Lonestar appointment-type eligibility gates (from Eligibility Verification Manual June 2026).
 */

export type LsrAppointmentTypeCode =
  | 'NP'
  | 'TVNP'
  | 'FUV'
  | '2nd FU'
  | 'TV FU'
  | 'US'
  | 'S-NP'
  | 'S-TVNP'
  | 'S-FU'
  | 'S-2nd FU'
  | 'S-TVFU'
  | 'CMA-Admin Injections'
  | 'Infusion'
  | 'Vit IM-IV Infusion'
  | string

const RUN_ELIGIBILITY = new Set([
  'NP',
  'TVNP',
  'FUV',
  '2nd FU',
  '2ND FU',
  'TV FU',
  'TVFU',
  'US',
  'ULTRASOUND',
])

const SKIP_ELIGIBILITY = new Set([
  'S-NP',
  'S-TVNP',
  'S-FU',
  'S-2ND FU',
  'S-2nd FU',
  'S-TVFU',
  'CMA-ADMIN INJECTIONS',
  'INFUSION',
  'VIT IM-IV INFUSION',
])

/** Medicare of Texas NON-PAR fixed copays from LSR manual. */
export const MEDICARE_TX_NONPAR_COPAYS: {
  newPatientOvTv: string
  establishedOv: string
  establishedTv: string
} = {
  newPatientOvTv: '226.76',
  establishedOv: '121.80',
  establishedTv: '91.90',
}

export function normalizeAppointmentType(code?: string | null): string {
  return String(code || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function shouldRunEligibilityForAppointmentType(code?: string | null): {
  run: boolean
  reason: string
} {
  const normalized = normalizeAppointmentType(code)
  if (!normalized) {
    return { run: true, reason: 'No appointment type provided — default to run eligibility' }
  }
  if (SKIP_ELIGIBILITY.has(normalized)) {
    return { run: false, reason: `Do not run eligibility for appointment type ${code}` }
  }
  if (RUN_ELIGIBILITY.has(normalized)) {
    return { run: true, reason: `Run eligibility for appointment type ${code}` }
  }
  // Unknown codes: allow run but note uncertainty
  return { run: true, reason: `Unknown appointment type ${code} — allowing eligibility` }
}

export function formModeForAppointmentType(code?: string | null): EligibilityFormMode {
  const normalized = normalizeAppointmentType(code)
  if (normalized === 'US' || normalized === 'ULTRASOUND') return 'ultrasound'
  return 'office_visit'
}

export function isTelevisitAppointment(code?: string | null): boolean {
  const normalized = normalizeAppointmentType(code)
  return normalized.includes('TV')
}

/** Lonestar SOP: call required for ALL Televisit and Ultrasound. */
export function requiresCallConfirmation(code?: string | null): {
  required: boolean
  reason?: string
} {
  const normalized = normalizeAppointmentType(code)
  if (normalized === 'US' || normalized === 'ULTRASOUND') {
    return { required: true, reason: 'Lonestar SOP: call required for all Ultrasound' }
  }
  if (isTelevisitAppointment(normalized)) {
    return { required: true, reason: 'Lonestar SOP: call required for all Televisit' }
  }
  return { required: false }
}

export function isMedicareOfTexasPayer(payerName?: string | null): boolean {
  const name = String(payerName || '').toLowerCase()
  return (
    /medicare\s+of\s+texas/.test(name) ||
    /medicare texas/.test(name) ||
    (/\bmedicare\b/.test(name) && /\btexas\b/.test(name) && !/advantage/.test(name))
  )
}

/**
 * When practice is NON-PAR with Medicare of Texas, skip portal/API and use fixed copays.
 */
export function buildMedicareTxNonParPacket(params: {
  appointmentType?: string | null
  isNewPatient?: boolean
}): RheumEligibilityPacket {
  const televisit = isTelevisitAppointment(params.appointmentType)
  const isNew = params.isNewPatient || normalizeAppointmentType(params.appointmentType).includes('NP')
  let copay: string = MEDICARE_TX_NONPAR_COPAYS.establishedOv
  if (isNew) copay = MEDICARE_TX_NONPAR_COPAYS.newPatientOvTv
  else if (televisit) copay = MEDICARE_TX_NONPAR_COPAYS.establishedTv

  const packet = createEmptyRheumPacket(
    formModeForAppointmentType(params.appointmentType),
    'medicare_tx_nonpar'
  )
  packet.planType = 'Medicare'
  packet.networkStatus = 'onn'
  packet.specialistCopay = `$${copay}`
  packet.verifiedBy = 'LSR Medicare TX NON-PAR schedule'
  const call = requiresCallConfirmation(params.appointmentType)
  if (call.required) {
    packet.callRequired = true
    packet.callRequiredReason = call.reason
  }
  return finalizeRheumPacket(packet)
}

export function applyCallRequiredFlag(
  packet: RheumEligibilityPacket,
  appointmentType?: string | null
): RheumEligibilityPacket {
  const call = requiresCallConfirmation(appointmentType)
  if (!call.required) return packet
  return finalizeRheumPacket({
    ...packet,
    callRequired: true,
    callRequiredReason: call.reason,
  })
}

export function structuredVoiceFallbackPrompt(params: {
  formMode: EligibilityFormMode
  missingFields: string[]
  appointmentType?: string | null
}): string {
  const fields = params.missingFields.length
    ? params.missingFields.join(', ')
    : 'specialistCopay, deductible, coinsurance, oop, referralRequired, telehealthAllowed'
  return [
    `Lonestar structured eligibility follow-up (${params.formMode}).`,
    params.appointmentType ? `Appointment type: ${params.appointmentType}.` : '',
    'Ask the insurer for the OV Benefit Verification fields that are still unknown:',
    fields,
    params.formMode === 'ultrasound'
      ? 'Also confirm CPT 76881 / 76882 / 76536 (verify ×2 if bilateral).'
      : 'Also confirm telehealth allowed when this is a televisit.',
  ]
    .filter(Boolean)
    .join(' ')
}
