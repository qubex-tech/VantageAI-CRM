/**
 * Shared patient identity matching for voice agents, MCP, and OD sync.
 * Phone numbers are NOT unique — family members often share one number.
 */

export type ParsedName = { firstName: string; lastName: string; fullName: string }

export type DemographicsInput = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | Date | null
}

export type PatientIdentityRow = {
  id: string
  name: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfBirth: Date | null
  phone?: string | null
  primaryPhone?: string | null
  externalEhrId?: string | null
}

export type OpenDentalChartFacts = {
  pat_num: number
  first_name: string
  last_name: string
  birthdate: string | null
  wireless_phone: string | null
}

export type PatientIdentityFacts = {
  caller: {
    first_name: string | null
    last_name: string | null
    full_name: string | null
    date_of_birth: string | null
  }
  crm_chart: {
    patient_id: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    date_of_birth: string | null
    external_ehr_id: string | null
  } | null
  open_dental_chart: OpenDentalChartFacts | null
  identity_match: boolean
  /** True when caller demographics differ from the linked Open Dental chart. */
  open_dental_identity_mismatch: boolean
  phone_collision_count: number
  /** Multiple CRM patients share this phone — may be different people (e.g. family). */
  phone_collisions: Array<{
    patient_id: string
    full_name: string | null
    date_of_birth: string | null
    external_ehr_id: string | null
    open_dental_chart: OpenDentalChartFacts | null
  }>
  can_create_separate_with_same_phone: true
  /** True when an existing phone match was found but caller demographics differ — agent must confirm merge vs new chart. */
  requires_agent_decision: boolean
  recommendation: 'use_existing' | 'create_new' | 'disambiguate' | 'verify_before_booking'
  warnings: string[]
}

/** Canonical phone key: last 10 digits (US). */
export function phoneMatchKey(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function parsePatientName(name: string | null | undefined): ParsedName | null {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0], fullName: parts[0] }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: trimmed,
  }
}

export function normalizeDobToIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const iso = value.toISOString().slice(0, 10)
    if (iso.startsWith('1900-01-01') || iso.startsWith('0001-01-01')) return null
    return iso
  }
  const raw = String(value).trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  const out = parsed.toISOString().slice(0, 10)
  if (out.startsWith('1900-01-01') || out.startsWith('0001-01-01')) return null
  return out
}

export function resolveDemographics(input: DemographicsInput): {
  firstName: string | null
  lastName: string | null
  fullName: string | null
  dateOfBirth: string | null
} {
  let firstName = input.firstName?.trim() || null
  let lastName = input.lastName?.trim() || null
  if ((!firstName || !lastName) && input.name) {
    const parsed = parsePatientName(input.name)
    if (parsed) {
      firstName = firstName || parsed.firstName
      lastName = lastName || parsed.lastName
    }
  }
  const fullName =
    input.name?.trim() ||
    (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName) ||
    null
  return {
    firstName,
    lastName,
    fullName,
    dateOfBirth: normalizeDobToIso(input.dateOfBirth),
  }
}

function namesLooselyMatch(a: ParsedName | null, b: ParsedName | null): boolean {
  if (!a || !b) return false
  const af = a.firstName.toLowerCase()
  const al = a.lastName.toLowerCase()
  const bf = b.firstName.toLowerCase()
  const bl = b.lastName.toLowerCase()
  return af === bf && al === bl
}

/** True when first name, last name, and full DOB (year included) all match. */
export function demographicsMatch(
  patient: PatientIdentityRow,
  caller: DemographicsInput
): boolean {
  const c = resolveDemographics(caller)
  if (!c.firstName || !c.lastName || !c.dateOfBirth) return false

  const pFirst = patient.firstName?.trim() || parsePatientName(patient.name)?.firstName
  const pLast = patient.lastName?.trim() || parsePatientName(patient.name)?.lastName
  const pDob = normalizeDobToIso(patient.dateOfBirth)
  if (!pFirst || !pLast || !pDob) return false

  return (
    pFirst.toLowerCase() === c.firstName.toLowerCase() &&
    pLast.toLowerCase() === c.lastName.toLowerCase() &&
    pDob === c.dateOfBirth
  )
}

export function extractPatNum(externalEhrId: string | null | undefined): number | null {
  if (!externalEhrId?.startsWith('opendental:')) return null
  const n = Number(externalEhrId.slice('opendental:'.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function fetchOpenDentalChartFacts(
  practiceId: string,
  externalEhrId: string | null | undefined
): Promise<OpenDentalChartFacts | null> {
  const patNum = extractPatNum(externalEhrId)
  if (!patNum) return null
  try {
    const { getOpenDentalServices, getOpenDentalConnection } = await import(
      '@/lib/integrations/opendental/factory'
    )
    const connection = await getOpenDentalConnection(practiceId)
    if (!connection?.isActive) return null
    const services = await getOpenDentalServices(practiceId)
    const od = (await services.patients.get(patNum)) as Record<string, unknown>
    return {
      pat_num: patNum,
      first_name: String(od.FName ?? '').trim(),
      last_name: String(od.LName ?? '').trim(),
      birthdate: normalizeDobToIso(String(od.Birthdate ?? '')),
      wireless_phone: String(od.WirelessPhone ?? od.HmPhone ?? '').trim() || null,
    }
  } catch {
    return null
  }
}

export function openDentalChartMatchesCaller(
  od: OpenDentalChartFacts | null,
  caller: DemographicsInput
): boolean {
  if (!od) return true
  const c = resolveDemographics(caller)
  if (!c.firstName || !c.lastName || !c.dateOfBirth) return false
  return (
    od.first_name.toLowerCase() === c.firstName.toLowerCase() &&
    od.last_name.toLowerCase() === c.lastName.toLowerCase() &&
    od.birthdate === c.dateOfBirth
  )
}

export async function enrichPhoneCollisionsWithOdCharts(
  practiceId: string,
  collisions: PatientIdentityRow[]
): Promise<
  Array<{
    patient_id: string
    full_name: string | null
    date_of_birth: string | null
    external_ehr_id: string | null
    open_dental_chart: OpenDentalChartFacts | null
  }>
> {
  return Promise.all(
    collisions.map(async (p) => ({
      patient_id: p.id,
      full_name: p.name,
      date_of_birth: normalizeDobToIso(p.dateOfBirth),
      external_ehr_id: p.externalEhrId ?? null,
      open_dental_chart: await fetchOpenDentalChartFacts(practiceId, p.externalEhrId),
    }))
  )
}

export function buildPatientIdentityFacts(params: {
  caller: DemographicsInput
  selectedPatient: PatientIdentityRow | null
  phoneCollisions: PatientIdentityRow[]
  /** Pre-enriched collisions including open_dental_chart per row (preferred). */
  enrichedPhoneCollisions?: PatientIdentityFacts['phone_collisions']
  openDentalChart: OpenDentalChartFacts | null
  isNew?: boolean
  requiresAgentDecision?: boolean
}): PatientIdentityFacts {
  const caller = resolveDemographics(params.caller)
  const warnings: string[] = []
  let recommendation: PatientIdentityFacts['recommendation'] = 'create_new'

  const crmChart = params.selectedPatient
    ? {
        patient_id: params.selectedPatient.id,
        first_name: params.selectedPatient.firstName ?? parsePatientName(params.selectedPatient.name)?.firstName ?? null,
        last_name: params.selectedPatient.lastName ?? parsePatientName(params.selectedPatient.name)?.lastName ?? null,
        full_name: params.selectedPatient.name,
        date_of_birth: normalizeDobToIso(params.selectedPatient.dateOfBirth),
        external_ehr_id: params.selectedPatient.externalEhrId ?? null,
      }
    : null

  const identityMatch = params.selectedPatient
    ? demographicsMatch(params.selectedPatient, params.caller)
    : false

  const odMismatch =
    params.openDentalChart !== null &&
    !openDentalChartMatchesCaller(params.openDentalChart, params.caller)

  if (params.phoneCollisions.length > 1) {
    warnings.push(
      `${params.phoneCollisions.length} patients in this practice share this phone number. Verify full name and date of birth (including year) before booking.`
    )
  }

  if (
    params.requiresAgentDecision ||
    (params.phoneCollisions.length > 0 && !params.selectedPatient && !params.isNew)
  ) {
    const collisionSummary = (params.enrichedPhoneCollisions ?? [])
      .map((c) => {
        const od = c.open_dental_chart
        const label = od
          ? `${od.first_name} ${od.last_name} (DOB ${od.birthdate ?? 'unknown'}, PatNum ${od.pat_num})`
          : `${c.full_name ?? 'Unknown'} (DOB ${c.date_of_birth ?? 'unknown'})`
        return label
      })
      .join('; ')
    if (collisionSummary) {
      warnings.push(
        `Existing patient(s) on this phone: ${collisionSummary}. Caller reported ${caller.fullName ?? 'unknown'} (DOB ${caller.dateOfBirth ?? 'unknown'}). Confirm with the caller if this is the same person (use existing patient_id) or a different family member (call again with force_create=true to register separately).`
      )
    }
  }

  if (odMismatch && params.openDentalChart) {
    warnings.push(
      `Open Dental chart PatNum ${params.openDentalChart.pat_num} is ${params.openDentalChart.first_name} ${params.openDentalChart.last_name} (DOB ${params.openDentalChart.birthdate ?? 'unknown'}), which does not match the caller. Do not book on this chart — create a separate patient.`
    )
  }

  if (params.selectedPatient && !identityMatch && !params.isNew) {
    warnings.push(
      `CRM patient ${crmChart?.full_name ?? params.selectedPatient.id} (DOB ${crmChart?.date_of_birth ?? 'unknown'}) does not match caller ${caller.fullName ?? 'unknown'} (DOB ${caller.dateOfBirth ?? 'unknown'}).`
    )
  }

  if (params.isNew) {
    recommendation = 'create_new'
  } else if (params.requiresAgentDecision || (params.phoneCollisions.length > 0 && !params.selectedPatient)) {
    recommendation = 'disambiguate'
  } else if (params.phoneCollisions.length > 1 && !identityMatch) {
    recommendation = 'disambiguate'
  } else if (odMismatch) {
    recommendation = 'verify_before_booking'
  } else if (identityMatch && params.selectedPatient) {
    recommendation = 'use_existing'
  } else if (params.selectedPatient && !identityMatch) {
    recommendation = 'create_new'
  }

  const requiresAgentDecision =
    Boolean(params.requiresAgentDecision) ||
    (params.phoneCollisions.length > 0 && !params.selectedPatient && !params.isNew)

  const phoneCollisionsOut =
    params.enrichedPhoneCollisions ??
    params.phoneCollisions.map((p) => ({
      patient_id: p.id,
      full_name: p.name,
      date_of_birth: normalizeDobToIso(p.dateOfBirth),
      external_ehr_id: p.externalEhrId ?? null,
      open_dental_chart: null as OpenDentalChartFacts | null,
    }))

  return {
    caller: {
      first_name: caller.firstName,
      last_name: caller.lastName,
      full_name: caller.fullName,
      date_of_birth: caller.dateOfBirth,
    },
    crm_chart: crmChart,
    open_dental_chart: params.openDentalChart,
    identity_match: identityMatch,
    open_dental_identity_mismatch: odMismatch,
    phone_collision_count: params.phoneCollisions.length,
    phone_collisions: phoneCollisionsOut,
    can_create_separate_with_same_phone: true,
    requires_agent_decision: requiresAgentDecision,
    recommendation,
    warnings,
  }
}

/** Safe fields to update on an existing patient when identity already matches. */
export function buildSafePatientUpdate(
  patient: PatientIdentityRow,
  details: DemographicsInput & { email?: string | null },
  openDentalChart: OpenDentalChartFacts | null
): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  const odLinked = Boolean(patient.externalEhrId?.startsWith('opendental:'))
  const identityOk = demographicsMatch(patient, details)
  const odOk = openDentalChartMatchesCaller(openDentalChart, details)

  // Never overwrite name/DOB on an OD-linked chart when caller identity differs.
  if (!odLinked || (identityOk && odOk)) {
    const c = resolveDemographics(details)
    if (c.fullName && c.fullName !== patient.name) update.name = c.fullName
    if (c.dateOfBirth) {
      const existing = normalizeDobToIso(patient.dateOfBirth)
      if (c.dateOfBirth !== existing) update.dateOfBirth = new Date(`${c.dateOfBirth}T00:00:00.000Z`)
    }
  }

  if (details.email) update.email = details.email
  return update
}
