/**
 * Lonestar Rheumatology–shaped eligibility packet (OV Benefit Verification Form + mode stubs).
 * Shared across Availity API, portal RPA, voice, and manual short-circuits.
 */

export type EligibilityFormMode = 'office_visit' | 'ultrasound' | 'cimzia' | 'injectable_bone'

export type EligibilityNetworkStatus = 'inn' | 'onn' | 'unknown'

export type EligibilityPacketSource =
  | 'availity_api'
  | 'stedi_api'
  | 'availity_rpa'
  | 'voice'
  | 'manual'
  | 'medicare_tx_nonpar'

export interface RheumMoneyFields {
  total?: string
  /** Out-of-pocket maximum (alias used for OOP rows). */
  max?: string
  met?: string
  remaining?: string
}

export interface RheumCptCheck {
  code: string
  verified?: boolean | null
  notes?: string
}

export interface RheumEligibilityPacket {
  formMode: EligibilityFormMode
  /** Member Status from Availity (e.g. Active Coverage). */
  memberStatus?: string
  networkStatus?: EligibilityNetworkStatus
  planType?: string
  specialistCopay?: string
  deductible?: RheumMoneyFields
  coinsurance?: string
  oop?: RheumMoneyFields
  /** Free-text Limitations row under the selected benefit service. */
  limitations?: string
  referralRequired?: boolean | null
  authRequired?: boolean | null
  precertRequired?: boolean | null
  telehealthAllowed?: boolean | null
  /** Cimzia / injectable forms */
  buyAndBill?: boolean | null
  cptChecks?: RheumCptCheck[]
  /** SOP: Lonestar requires phone confirmation for televisit + ultrasound */
  callRequired?: boolean
  callRequiredReason?: string
  unknownFields?: string[]
  verifiedBy?: string
  verifiedAt?: string
  agentName?: string
  referenceNumber?: string
  source?: EligibilityPacketSource
}

export const OV_CPT_CODES = [
  '99205',
  '99215',
  '96372',
  'J1010',
  '20600',
  '20605',
  '20610',
  '20550',
  '20552',
  '20553',
] as const

export const ULTRASOUND_CPT_CODES = ['76881', '76882', '76536'] as const

export const CIMZIA_CPT_CODES = ['J0717', '96401'] as const

export const INJECTABLE_BONE_CPT_CODES = ['J3111', 'Q5136', 'J0897', '96401'] as const

export function defaultCptChecksForMode(mode: EligibilityFormMode): RheumCptCheck[] {
  const codes =
    mode === 'ultrasound'
      ? ULTRASOUND_CPT_CODES
      : mode === 'cimzia'
        ? CIMZIA_CPT_CODES
        : mode === 'injectable_bone'
          ? INJECTABLE_BONE_CPT_CODES
          : OV_CPT_CODES
  return codes.map((code) => ({ code, verified: null }))
}

export function createEmptyRheumPacket(
  formMode: EligibilityFormMode = 'office_visit',
  source?: EligibilityPacketSource
): RheumEligibilityPacket {
  return {
    formMode,
    source,
    cptChecks: defaultCptChecksForMode(formMode),
    unknownFields: [],
  }
}

/** Compute which OV financial fields are still missing for UI badges. */
export function listUnknownRheumFields(packet: RheumEligibilityPacket): string[] {
  const unknown: string[] = []
  if (!packet.networkStatus || packet.networkStatus === 'unknown') unknown.push('networkStatus')
  if (!packet.planType) unknown.push('planType')
  if (!packet.specialistCopay) unknown.push('specialistCopay')
  if (!packet.deductible?.total && !packet.deductible?.remaining) unknown.push('deductible')
  if (!packet.coinsurance) unknown.push('coinsurance')
  if (!packet.oop?.max && !packet.oop?.remaining) unknown.push('oop')
  if (packet.referralRequired == null) unknown.push('referralRequired')
  if (packet.authRequired == null) unknown.push('authRequired')
  if (packet.telehealthAllowed == null && packet.formMode === 'office_visit') {
    unknown.push('telehealthAllowed')
  }
  return unknown
}

export function finalizeRheumPacket(packet: RheumEligibilityPacket): RheumEligibilityPacket {
  const unknownFields = listUnknownRheumFields(packet)
  return {
    ...packet,
    unknownFields,
    verifiedAt: packet.verifiedAt || new Date().toISOString(),
  }
}

export function formatRheumPacketNoteSection(packet: RheumEligibilityPacket): string {
  const lines: string[] = ['', 'OV Benefit Verification']
  lines.push(`Form mode: ${packet.formMode}`)
  if (packet.source) lines.push(`Source: ${packet.source}`)
  if (packet.memberStatus) lines.push(`Member status: ${packet.memberStatus}`)
  if (packet.planType) lines.push(`Plan type: ${packet.planType}`)
  if (packet.networkStatus) {
    lines.push(
      `Network: ${packet.networkStatus === 'inn' ? 'INN' : packet.networkStatus === 'onn' ? 'ONN' : 'Unknown'}`
    )
  }
  if (packet.specialistCopay) lines.push(`Specialist copay: ${packet.specialistCopay}`)
  if (packet.deductible) {
    const d = packet.deductible
    lines.push(
      `Deductible (total / met / remaining): ${[d.total, d.met, d.remaining].map((v) => v || '—').join(' / ')}`
    )
  }
  if (packet.coinsurance) lines.push(`Coinsurance: ${packet.coinsurance}`)
  if (packet.oop) {
    const o = packet.oop
    lines.push(
      `OOP (max / met / remaining): ${[o.max, o.met, o.remaining].map((v) => v || '—').join(' / ')}`
    )
  }
  if (packet.limitations) lines.push(`Limitations: ${packet.limitations}`)
  if (packet.referralRequired != null) {
    lines.push(`Referral required: ${packet.referralRequired ? 'Yes' : 'No'}`)
  }
  if (packet.authRequired != null) {
    lines.push(`Prior auth required: ${packet.authRequired ? 'Yes' : 'No'}`)
  }
  if (packet.precertRequired != null) {
    lines.push(`Pre-certification required: ${packet.precertRequired ? 'Yes' : 'No'}`)
  }
  if (packet.telehealthAllowed != null) {
    lines.push(`Telehealth allowed: ${packet.telehealthAllowed ? 'Yes' : 'No'}`)
  }
  if (packet.buyAndBill != null) {
    lines.push(`Buy & Bill: ${packet.buyAndBill ? 'Yes' : 'No'}`)
  }
  if (packet.callRequired) {
    lines.push(`Call required: Yes${packet.callRequiredReason ? ` (${packet.callRequiredReason})` : ''}`)
  }
  const unknown = packet.unknownFields?.length ? packet.unknownFields : listUnknownRheumFields(packet)
  if (unknown.length > 0) {
    lines.push(`Needs call / unknown: ${unknown.join(', ')}`)
  }
  if (packet.verifiedBy) lines.push(`Verified by: ${packet.verifiedBy}`)
  if (packet.verifiedAt) lines.push(`Verified at: ${packet.verifiedAt}`)
  if (packet.agentName) lines.push(`Agent: ${packet.agentName}`)
  if (packet.referenceNumber) lines.push(`Call ref #: ${packet.referenceNumber}`)
  return lines.join('\n')
}

export function parseTriStateFlag(text: string, positive: RegExp, negative: RegExp): boolean | null {
  if (positive.test(text)) return true
  if (negative.test(text)) return false
  return null
}
