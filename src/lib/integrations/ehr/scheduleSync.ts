import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import {
  getEhrSettings,
  getEcwClientAssertionAud,
  getPrivateKeyJwtConfig,
} from '@/lib/integrations/ehr/server'
import { createClientAssertion } from '@/lib/integrations/ehr/smartEngine'
import { FhirClient } from '@/lib/integrations/fhir/fhirClient'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'

const WRITEBACK_PROVIDER_ID = 'ecw_write'
const STALE_SYNC_WINDOW_MS = 12 * 60 * 60 * 1000
const SYNC_TIMEZONE = 'America/Chicago'

const DEFAULT_SCHEDULE_PRACTITIONER_FFBJCD =
  'Practitioner/Lt2IFR5Ah76n4d8TFP5gBPiX1g1-Q2P9s8IYoGZvbFM'
const DEFAULT_SCHEDULE_PRACTITIONER_FACGCD =
  'Practitioner/W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'

type FhirEncounter = {
  id?: string
  status?: string
  period?: { start?: string; end?: string }
  subject?: { reference?: string }
  participant?: Array<{ individual?: { reference?: string } }>
  type?: Array<{ text?: string; coding?: Array<{ display?: string }> }>
  reasonCode?: Array<{ text?: string; coding?: Array<{ display?: string }> }>
}

type FhirBundle<TResource = any> = {
  entry?: Array<{ resource?: TResource }>
  link?: Array<{ relation?: string; url?: string }>
}

type FhirPatient = {
  id?: string
  name?: Array<{ text?: string; family?: string; given?: string[] }>
  birthDate?: string
  gender?: string
  telecom?: Array<{ system?: string; value?: string }>
}

type SyncOptions = {
  force?: boolean
  businessDays?: number
}

export type EhrPractitionerOption = {
  id: string
  reference: string
  name: string
}

type FhirPractitioner = {
  id?: string
  name?: Array<{ text?: string; family?: string; given?: string[] }>
}

function normalizePractitionerReference(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('Practitioner/')) return trimmed
  if (trimmed.includes('/')) return null
  return `Practitioner/${trimmed}`
}

function inferDefaultPractitionerRef(issuer: string) {
  const normalized = issuer.toLowerCase()
  if (normalized.includes('/facgcd')) return DEFAULT_SCHEDULE_PRACTITIONER_FACGCD
  return DEFAULT_SCHEDULE_PRACTITIONER_FFBJCD
}

function parsePractitionerRefsFromConfig(config: Record<string, unknown>, issuer: string) {
  const explicitRefs = typeof config.ecwSchedulePractitionerRefs === 'string'
    ? config.ecwSchedulePractitionerRefs
        .split(',')
        .map((value) => normalizePractitionerReference(value))
        .filter((value): value is string => Boolean(value))
    : []
  if (explicitRefs.length > 0) {
    return Array.from(new Set(explicitRefs))
  }

  const participantRef = typeof config.ecwTelephoneParticipantPractitionerRef === 'string'
    ? normalizePractitionerReference(config.ecwTelephoneParticipantPractitionerRef)
    : null
  if (participantRef) {
    return [participantRef]
  }

  return [inferDefaultPractitionerRef(issuer)]
}

function getTzWeekday(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
}

function formatTzDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function getUpcomingBusinessDays(count: number, timeZone = SYNC_TIMEZONE) {
  const days: string[] = []
  const cursor = new Date()

  while (days.length < count) {
    const weekday = getTzWeekday(cursor, timeZone)
    const isWeekend = weekday === 'Sat' || weekday === 'Sun'
    if (!isWeekend) {
      days.push(formatTzDate(cursor, timeZone))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

function addUtcDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function normalizeEhrPatientId(value: string | undefined | null) {
  if (!value) return null
  let normalized = value.trim()
  if (!normalized) return null
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep raw value when decoding fails.
  }
  normalized = normalized.split('?')[0].split('#')[0].replace(/^\/+/, '')

  if (normalized.startsWith('Patient/')) {
    normalized = normalized.slice('Patient/'.length)
  } else {
    const marker = '/Patient/'
    const markerIndex = normalized.lastIndexOf(marker)
    if (markerIndex >= 0) {
      normalized = normalized.slice(markerIndex + marker.length)
    }
  }

  const historyIndex = normalized.indexOf('/_history/')
  if (historyIndex >= 0) {
    normalized = normalized.slice(0, historyIndex)
  }

  normalized = normalized.split('/')[0].trim()
  return normalized || null
}

function parsePatientIdFromReference(reference: string | undefined) {
  return normalizeEhrPatientId(reference)
}

function formatPatientName(patient: FhirPatient) {
  const name = patient.name?.[0]
  if (!name) return null
  if (name.text?.trim()) return name.text.trim()
  const combined = [...(name.given || []), name.family || ''].filter(Boolean).join(' ').trim()
  return combined || null
}

function mapEncounterStatusToAppointment(status: string | undefined) {
  switch (status) {
    case 'arrived':
    case 'triaged':
    case 'in-progress':
      return 'confirmed'
    case 'finished':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'planned':
    default:
      return 'scheduled'
  }
}

function getEncounterVisitType(encounter: FhirEncounter) {
  return (
    encounter.type?.[0]?.text ||
    encounter.type?.[0]?.coding?.[0]?.display ||
    'EHR Appointment'
  )
}

function getEncounterReason(encounter: FhirEncounter) {
  return encounter.reasonCode?.[0]?.text || encounter.reasonCode?.[0]?.coding?.[0]?.display || null
}

async function fetchEncounterPages(client: FhirClient, initialPath: string) {
  const encounters: FhirEncounter[] = []
  let nextPath: string | undefined = initialPath

  while (nextPath) {
    const responseBundle: FhirBundle<FhirEncounter> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      if (entry.resource?.id) {
        encounters.push(entry.resource)
      }
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink || undefined
  }

  return encounters
}

function formatPractitionerName(practitioner: FhirPractitioner) {
  const name = practitioner.name?.[0]
  if (!name) return null
  if (name.text?.trim()) return name.text.trim()
  const combined = [...(name.given || []), name.family || ''].filter(Boolean).join(' ').trim()
  return combined || null
}

async function fetchPractitionerPages(client: FhirClient, initialPath: string) {
  const practitioners: FhirPractitioner[] = []
  let nextPath: string | undefined = initialPath

  while (nextPath) {
    const responseBundle: FhirBundle<FhirPractitioner> = await client.request(nextPath)
    for (const entry of responseBundle.entry || []) {
      if (entry.resource?.id) {
        practitioners.push(entry.resource)
      }
    }
    const nextLink = responseBundle.link?.find((link) => link.relation === 'next')?.url
    nextPath = nextLink || undefined
  }

  return practitioners
}

async function upsertPatientFromEhr(params: {
  practiceId: string
  client: FhirClient
  patientId: string
  cache: Map<string, string>
}) {
  const normalizedPatientId = normalizeEhrPatientId(params.patientId)
  if (!normalizedPatientId) {
    throw new Error('Invalid EHR patient identifier')
  }

  const cached = params.cache.get(normalizedPatientId)
  if (cached) {
    return cached
  }

  const existing = await prisma.patient.findFirst({
    where: {
      practiceId: params.practiceId,
      deletedAt: null,
      OR: [
        { externalEhrId: normalizedPatientId },
        { externalEhrId: `Patient/${normalizedPatientId}` },
        { externalEhrId: { endsWith: `/Patient/${normalizedPatientId}` } },
        { externalEhrId: { startsWith: `Patient/${normalizedPatientId}/_history/` } },
      ],
    },
  })
  if (existing) {
    if (existing.externalEhrId !== normalizedPatientId) {
      await prisma.patient.update({
        where: { id: existing.id },
        data: { externalEhrId: normalizedPatientId },
      })
    }
    params.cache.set(normalizedPatientId, existing.id)
    return existing.id
  }

  let patient: FhirPatient | null = null
  try {
    patient = await params.client.request<FhirPatient>(`/Patient/${normalizedPatientId}`)
  } catch {
    patient = null
  }

  const fullName = formatPatientName(patient || {}) || `EHR Patient ${normalizedPatientId.slice(0, 8)}`
  const primaryPhone =
    patient?.telecom?.find((entry) => entry.system === 'phone')?.value?.trim() || null
  const email = patient?.telecom?.find((entry) => entry.system === 'email')?.value?.trim() || null
  const firstName = patient?.name?.[0]?.given?.[0] || null
  const lastName = patient?.name?.[0]?.family || null
  const birthDate = patient?.birthDate ? new Date(patient.birthDate) : null

  // Before creating a new profile, merge with an existing local patient match and attach EHR ID.
  const mergeOrConditions: Array<Record<string, unknown>> = []
  if (email) {
    mergeOrConditions.push({ email: { equals: email, mode: 'insensitive' } })
  }
  if (primaryPhone) {
    mergeOrConditions.push({ primaryPhone })
    mergeOrConditions.push({ phone: primaryPhone })
  }
  if (fullName && birthDate) {
    mergeOrConditions.push({
      AND: [{ name: { equals: fullName, mode: 'insensitive' } }, { dateOfBirth: birthDate }],
    })
  }

  if (mergeOrConditions.length > 0) {
    const mergeCandidate = await prisma.patient.findFirst({
      where: {
        practiceId: params.practiceId,
        deletedAt: null,
        externalEhrId: null,
        OR: mergeOrConditions as any,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (mergeCandidate) {
      const merged = await prisma.patient.update({
        where: { id: mergeCandidate.id },
        data: {
          externalEhrId: normalizedPatientId,
          firstName: mergeCandidate.firstName || firstName,
          lastName: mergeCandidate.lastName || lastName,
          name: mergeCandidate.name || fullName,
          dateOfBirth: mergeCandidate.dateOfBirth || birthDate,
          gender: mergeCandidate.gender || patient?.gender || null,
          primaryPhone: mergeCandidate.primaryPhone || primaryPhone,
          phone: mergeCandidate.phone || primaryPhone || mergeCandidate.phone,
          email: mergeCandidate.email || email,
          consentSource: mergeCandidate.consentSource || 'import',
        },
      })

      params.cache.set(normalizedPatientId, merged.id)
      return merged.id
    }
  }

  const created = await prisma.patient.create({
    data: {
      practiceId: params.practiceId,
      externalEhrId: normalizedPatientId,
      name: fullName,
      firstName,
      lastName,
      dateOfBirth: birthDate,
      gender: patient?.gender || null,
      primaryPhone,
      phone: primaryPhone || 'unknown',
      email,
      preferredContactMethod: primaryPhone ? 'phone' : 'email',
      consentSource: 'import',
    },
  })

  params.cache.set(normalizedPatientId, created.id)
  return created.id
}

async function getWritebackConnection(practiceId: string) {
  const connections = await prisma.ehrConnection.findMany({
    where: {
      tenantId: practiceId,
      providerId: WRITEBACK_PROVIDER_ID,
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return connections[0] || null
}

async function createEhrClientForPractice(practiceId: string) {
  const connection = await getWritebackConnection(practiceId)
  if (!connection?.accessTokenEnc) {
    return null
  }

  const refreshedConnection = await refreshBackendConnectionIfNeeded({ connection })
  if (!refreshedConnection.accessTokenEnc) {
    return null
  }
  const tokenEndpoint = refreshedConnection.tokenEndpoint || undefined
  const privateKeyConfig = tokenEndpoint ? getPrivateKeyJwtConfig(connection.providerId) : null
  const audOverride = connection.providerId.startsWith('ecw')
    ? getEcwClientAssertionAud(connection.issuer)
    : undefined

  const client = new FhirClient({
    baseUrl: refreshedConnection.fhirBaseUrl,
    tokenEndpoint,
    clientId: refreshedConnection.clientId,
    clientSecret:
      !privateKeyConfig && refreshedConnection.clientSecretEnc
        ? decryptString(refreshedConnection.clientSecretEnc)
        : undefined,
    clientAssertionProvider:
      privateKeyConfig && tokenEndpoint
        ? () =>
            createClientAssertion({
              clientId: refreshedConnection.clientId,
              tokenEndpoint,
              privateKeyPem: privateKeyConfig.privateKeyPem,
              keyId: privateKeyConfig.keyId,
              audience: audOverride,
            })
        : undefined,
    tokenState: {
      accessToken: decryptString(refreshedConnection.accessTokenEnc),
      refreshToken: refreshedConnection.refreshTokenEnc
        ? decryptString(refreshedConnection.refreshTokenEnc)
        : undefined,
      tokenType: undefined,
      expiresAt: refreshedConnection.expiresAt,
      scopes: refreshedConnection.scopesGranted || undefined,
    },
    onTokenRefresh: async (tokenResponse) => {
      await prisma.ehrConnection.update({
        where: { id: refreshedConnection.id },
        data: {
          accessTokenEnc: encryptString(tokenResponse.access_token),
          refreshTokenEnc: tokenResponse.refresh_token
            ? encryptString(tokenResponse.refresh_token)
            : refreshedConnection.refreshTokenEnc,
          expiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : refreshedConnection.expiresAt,
          scopesGranted: tokenResponse.scope || refreshedConnection.scopesGranted,
        },
      })
    },
  })

  return { client, connection: refreshedConnection }
}

export async function syncEhrAppointmentsForPractice(practiceId: string, options: SyncOptions = {}) {
  const force = options.force === true
  const businessDays = options.businessDays || 5

  if (!force) {
    const latestSync = await prisma.integrationAuditLog.findFirst({
      where: {
        tenantId: practiceId,
        action: 'EHR_APPOINTMENT_SYNC_COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (latestSync && Date.now() - latestSync.createdAt.getTime() < STALE_SYNC_WINDOW_MS) {
      return { status: 'skipped' as const, reason: 'fresh_sync_exists' }
    }
  }

  const ehrContext = await createEhrClientForPractice(practiceId)
  if (!ehrContext) {
    return { status: 'skipped' as const, reason: 'missing_connection' }
  }
  const { client, connection } = ehrContext

  const settings = await getEhrSettings(practiceId)
  if (!settings?.enabledProviders?.includes(WRITEBACK_PROVIDER_ID as any)) {
    return { status: 'skipped' as const, reason: 'provider_disabled' }
  }
  const writeConfig =
    (settings?.providerConfigs?.[WRITEBACK_PROVIDER_ID] as Record<string, unknown> | undefined) || {}
  const practitionerRefs = parsePractitionerRefsFromConfig(writeConfig, connection.issuer)
  if (practitionerRefs.length === 0) {
    return { status: 'skipped' as const, reason: 'missing_practitioner_refs' }
  }

  const days = getUpcomingBusinessDays(businessDays, SYNC_TIMEZONE)
  const encounteredIds = new Set<string>()
  const patientCache = new Map<string, string>()

  let synced = 0
  let created = 0
  let updated = 0
  let skipped = 0

  for (const practitionerRef of practitionerRefs) {
    for (const day of days) {
      const nextDay = addUtcDay(day)
      const query = `/Encounter?practitioner=${encodeURIComponent(
        practitionerRef
      )}&date=ge${day}&date=lt${nextDay}&_count=200`
      let encounters: FhirEncounter[] = []
      try {
        encounters = await fetchEncounterPages(client, query)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await logEhrAudit({
          tenantId: practiceId,
          actorUserId: null,
          action: 'EHR_APPOINTMENT_SYNC_ERROR',
          providerId: WRITEBACK_PROVIDER_ID,
          entity: 'Encounter',
          metadata: {
            practitionerRef,
            day,
            query,
            error: message,
          },
        })
        continue
      }

      for (const encounter of encounters) {
        if (!encounter.id) {
          skipped += 1
          continue
        }
        if (encounteredIds.has(encounter.id)) {
          skipped += 1
          continue
        }
        encounteredIds.add(encounter.id)

        const patientEhrId = parsePatientIdFromReference(encounter.subject?.reference)
        if (!patientEhrId) {
          skipped += 1
          continue
        }

        const start = encounter.period?.start ? new Date(encounter.period.start) : null
        if (!start || Number.isNaN(start.getTime())) {
          skipped += 1
          continue
        }
        const end =
          encounter.period?.end && !Number.isNaN(new Date(encounter.period.end).getTime())
            ? new Date(encounter.period.end)
            : new Date(start.getTime() + 30 * 60 * 1000)
        const appointmentKey = `ehr:${encounter.id}`

        const patientId = await upsertPatientFromEhr({
          practiceId,
          client,
          patientId: patientEhrId,
          cache: patientCache,
        })
        const providerRef =
          encounter.participant?.[0]?.individual?.reference || practitionerRef

        const existing = await prisma.appointment.findUnique({
          where: { calBookingId: appointmentKey },
          select: { id: true },
        })

        await prisma.appointment.upsert({
          where: { calBookingId: appointmentKey },
          create: {
            practiceId,
            patientId,
            providerId: providerRef,
            status: mapEncounterStatusToAppointment(encounter.status),
            startTime: start,
            endTime: end,
            timezone: SYNC_TIMEZONE,
            visitType: getEncounterVisitType(encounter),
            reason: getEncounterReason(encounter),
            notes: `Synced from ECW Encounter/${encounter.id}`,
            calBookingId: appointmentKey,
            calEventId: 'ehr',
          },
          update: {
            patientId,
            providerId: providerRef,
            status: mapEncounterStatusToAppointment(encounter.status),
            startTime: start,
            endTime: end,
            timezone: SYNC_TIMEZONE,
            visitType: getEncounterVisitType(encounter),
            reason: getEncounterReason(encounter),
            notes: `Synced from ECW Encounter/${encounter.id}`,
          },
        })

        synced += 1
        if (existing) {
          updated += 1
        } else {
          created += 1
        }
      }
    }
  }

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId: null,
    action: 'EHR_APPOINTMENT_SYNC_COMPLETE',
    providerId: WRITEBACK_PROVIDER_ID,
    entity: 'Encounter',
    metadata: {
      businessDays,
      practitionerRefs,
      synced,
      created,
      updated,
      skipped,
    },
  })

  return {
    status: 'success' as const,
    synced,
    created,
    updated,
    skipped,
  }
}

export async function syncEhrAppointmentsAcrossPractices() {
  const connections = await prisma.ehrConnection.findMany({
    where: {
      providerId: WRITEBACK_PROVIDER_ID,
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    select: {
      tenantId: true,
    },
  })

  const practiceIds = Array.from(new Set(connections.map((connection) => connection.tenantId)))
  const results: Array<{ practiceId: string; status: string; details?: unknown }> = []

  for (const practiceId of practiceIds) {
    try {
      const result = await syncEhrAppointmentsForPractice(practiceId)
      results.push({ practiceId, status: result.status, details: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ practiceId, status: 'error', details: { error: message } })
    }
  }

  return { totalPractices: practiceIds.length, results }
}

export async function listEhrPractitionersForPractice(practiceId: string): Promise<EhrPractitionerOption[]> {
  const ehrContext = await createEhrClientForPractice(practiceId)
  if (!ehrContext) {
    return []
  }

  const { client } = ehrContext
  const practitioners = await fetchPractitionerPages(client, '/Practitioner?_count=200')
  const options = practitioners
    .filter((practitioner) => Boolean(practitioner.id))
    .map((practitioner) => {
      const id = practitioner.id as string
      return {
        id,
        reference: `Practitioner/${id}`,
        name: formatPractitionerName(practitioner) || `Practitioner ${id.slice(0, 8)}`,
      }
    })

  const deduped = new Map<string, EhrPractitionerOption>()
  for (const option of options) {
    if (!deduped.has(option.reference)) {
      deduped.set(option.reference, option)
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name))
}
