/**
 * Full eCW patient roster sync helpers.
 * Prefer Group/$export when available; fall back to Patient?name= letter crawl
 * (eCW currently 500s Group export/search for some practices).
 */
import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import { extractEcwSecondaryMrn } from '@/lib/integrations/ehr/ecwPatientIds'

export type FhirPatient = {
  resourceType?: string
  id?: string
  identifier?: Array<{ use?: string; system?: string; value?: string }>
  name?: Array<{ family?: string; given?: string[] }>
  birthDate?: string
  gender?: string
  telecom?: Array<{ system?: string; value?: string }>
  address?: Array<{
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
  }>
}

export type RosterUpsertCounts = {
  imported: number
  updated: number
  skipped: number
  errors: number
  processed: number
}

const NAME_CRAWL_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

function buildFullName(patient: FhirPatient) {
  const name = patient.name?.[0]
  const given = name?.given?.join(' ') || ''
  const family = name?.family || ''
  return [given, family].filter(Boolean).join(' ').trim()
}

export function mapFhirPatientRecord(patient: FhirPatient) {
  const name = buildFullName(patient)
  const telecom = patient.telecom || []
  const phone = telecom.find((entry) => entry.system === 'phone')?.value
  const email = telecom.find((entry) => entry.system === 'email')?.value
  const address = patient.address?.[0]
  const addressLine1 = address?.line?.[0]
  const addressLine2 = address?.line?.[1]
  const addressCombined = [addressLine1, addressLine2, address?.city, address?.state, address?.postalCode]
    .filter(Boolean)
    .join(', ')

  return {
    externalEhrId: patient.id || null,
    externalMrn: extractEcwSecondaryMrn(patient),
    firstName: patient.name?.[0]?.given?.[0] || null,
    lastName: patient.name?.[0]?.family || null,
    name: name || null,
    dateOfBirth: patient.birthDate ? new Date(`${patient.birthDate}T00:00:00.000Z`) : null,
    gender: patient.gender || null,
    primaryPhone: phone || null,
    phone: phone || null,
    email: email || null,
    addressLine1: addressLine1 || null,
    addressLine2: addressLine2 || null,
    address: addressCombined || null,
    city: address?.city || null,
    state: address?.state || null,
    postalCode: address?.postalCode || null,
  }
}

export function mergePatientUpdate<T extends Record<string, unknown>>(current: T, incoming: T) {
  const update: Partial<T> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined || value === '') continue
    if (current[key as keyof T] instanceof Date && value instanceof Date) {
      if ((current[key as keyof T] as Date).getTime() !== value.getTime()) {
        update[key as keyof T] = value as T[keyof T]
      }
      continue
    }
    if (current[key as keyof T] !== value) {
      update[key as keyof T] = value as T[keyof T]
    }
  }
  return update
}

export async function upsertFhirPatientForPractice(
  practiceId: string,
  patient: FhirPatient
): Promise<'imported' | 'updated' | 'skipped' | 'error'> {
  if (patient.resourceType !== 'Patient' || !patient.id) return 'skipped'
  try {
    const mapped = mapFhirPatientRecord(patient)
    const existing = await prisma.patient.findFirst({
      where: { practiceId, externalEhrId: patient.id },
    })
    if (!existing) {
      await prisma.patient.create({
        data: {
          practiceId,
          ...mapped,
          name: mapped.name || patient.id || 'Unknown',
          phone: mapped.phone || 'unknown',
          preferredContactMethod: 'phone',
          consentSource: 'import',
        },
      })
      return 'imported'
    }
    const update = mergePatientUpdate(
      existing as unknown as Record<string, unknown>,
      mapped as unknown as Record<string, unknown>
    )
    if (Object.keys(update).length === 0) return 'skipped'
    await prisma.patient.update({ where: { id: existing.id }, data: update })
    return 'updated'
  } catch {
    return 'error'
  }
}

function buildBulkBaseUrl(baseUrl: string, orgId: string) {
  const trimmed = baseUrl.replace(/\/+$/g, '')
  return trimmed.endsWith(`/${orgId}`) ? trimmed.slice(0, -1 * (orgId.length + 1)) : trimmed
}

function inferOrgId(fhirBaseUrl: string) {
  const trimmed = fhirBaseUrl.replace(/\/+$/g, '')
  return trimmed.split('/').pop() || ''
}

export async function getBackendAccessToken(connectionId: string) {
  const connection = await prisma.ehrConnection.findUnique({ where: { id: connectionId } })
  if (!connection?.accessTokenEnc) {
    throw new Error('No backend services connection available')
  }
  const refreshed = await refreshBackendConnectionIfNeeded({ connection })
  return {
    connection: refreshed,
    accessToken: decryptString(refreshed.accessTokenEnc!),
  }
}

export async function startEcwGroupPatientExport(params: {
  practiceId: string
  connectionId: string
  orgId?: string
  groupId: string
}) {
  const { accessToken, connection } = await getBackendAccessToken(params.connectionId)
  const orgId = params.orgId || inferOrgId(connection.fhirBaseUrl)
  if (!orgId) throw new Error('Missing orgId for bulk export')

  const baseUrl = buildBulkBaseUrl(connection.fhirBaseUrl, orgId)
  // Bare $export matched the last successful Lonestar kickoff shape.
  const exportUrl = `${baseUrl}/${orgId}/Group/${params.groupId}/$export?_type=Patient`

  const response = await fetch(exportUrl, {
    method: 'GET',
    headers: {
      accept: 'application/fhir+json',
      prefer: 'respond-async',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const responseText = await response.text()
  if (!response.ok) {
    await logEhrAudit({
      tenantId: params.practiceId,
      actorUserId: null,
      action: 'EHR_BULK_EXPORT_FAILED',
      providerId: connection.providerId,
      entity: 'EhrConnection',
      entityId: connection.id,
      metadata: {
        orgId,
        groupId: params.groupId,
        exportUrl,
        status: response.status,
        body: responseText.slice(0, 1000),
      },
    })
    throw new Error(`Bulk export start failed (${response.status}): ${responseText}`)
  }

  const contentLocation = response.headers.get('content-location') || undefined
  if (!contentLocation) {
    throw new Error(`Bulk export accepted but missing Content-Location: ${responseText.slice(0, 500)}`)
  }

  await logEhrAudit({
    tenantId: params.practiceId,
    actorUserId: null,
    action: 'EHR_BULK_EXPORT_START',
    providerId: connection.providerId,
    entity: 'EhrConnection',
    entityId: connection.id,
    metadata: {
      orgId,
      groupId: params.groupId,
      exportUrl,
      contentLocation,
      retryAfter: response.headers.get('retry-after'),
    },
  })

  return { statusUrl: contentLocation, exportUrl }
}

export async function checkEcwBulkExportStatus(params: {
  practiceId: string
  connectionId: string
  statusUrl: string
}) {
  const { accessToken, connection } = await getBackendAccessToken(params.connectionId)
  const response = await fetch(params.statusUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const responseText = await response.text()

  await logEhrAudit({
    tenantId: params.practiceId,
    actorUserId: null,
    action: 'EHR_BULK_EXPORT_STATUS',
    providerId: connection.providerId,
    entity: 'EhrConnection',
    entityId: connection.id,
    metadata: {
      statusUrl: params.statusUrl,
      status: response.status,
    },
  })

  if (response.status === 202) {
    return { status: 'in_progress' as const }
  }
  if (!response.ok) {
    throw new Error(`Bulk export status failed (${response.status}): ${responseText}`)
  }

  const parsed = responseText ? JSON.parse(responseText) : null
  const outputs = Array.isArray(parsed?.output) ? parsed.output : []
  const outputUrls = outputs
    .filter((item: { type?: string; url?: string }) => item?.type === 'Patient' && typeof item?.url === 'string')
    .map((item: { url: string }) => item.url)

  return { status: 'complete' as const, outputUrls }
}

/** Stream an NDJSON Patient file and upsert CRM rows. */
export async function ingestEcwPatientNdjsonUrl(params: {
  practiceId: string
  accessToken: string
  url: string
}): Promise<RosterUpsertCounts> {
  const response = await fetch(params.url, {
    method: 'GET',
    headers: {
      accept: 'application/fhir+ndjson, application/ndjson, application/json',
      authorization: `Bearer ${params.accessToken}`,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Bulk file download failed (${response.status}): ${text.slice(0, 500)}`)
  }
  if (!response.body) {
    throw new Error('Bulk file download missing response body')
  }

  const counts: RosterUpsertCounts = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    processed: 0,
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let patient: FhirPatient
    try {
      patient = JSON.parse(trimmed) as FhirPatient
    } catch {
      counts.errors += 1
      return
    }
    const result = await upsertFhirPatientForPractice(params.practiceId, patient)
    if (result === 'imported') counts.imported += 1
    else if (result === 'updated') counts.updated += 1
    else if (result === 'error') counts.errors += 1
    else counts.skipped += 1
    counts.processed += 1
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      await handleLine(line)
      newline = buffer.indexOf('\n')
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) await handleLine(buffer)

  return counts
}

export async function resolveEcwWriteConnection(practiceId: string) {
  return prisma.ehrConnection.findFirst({
    where: {
      tenantId: practiceId,
      providerId: 'ecw_write',
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function resolveEcwBulkConnection(practiceId: string) {
  return prisma.ehrConnection.findFirst({
    where: {
      tenantId: practiceId,
      providerId: 'ecw_bulk',
      authFlow: 'backend_services',
      status: 'connected',
      accessTokenEnc: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Crawl one Patient?name= query page chain and upsert. Uses ecw_write (search works there).
 * `seen` is mutated with eCW patient ids already handled in this run.
 */
export async function crawlEcwPatientsByNameQuery(params: {
  practiceId: string
  connectionId: string
  query: string
  seen: Set<string>
}): Promise<RosterUpsertCounts & { pages: number }> {
  let { accessToken, connection } = await getBackendAccessToken(params.connectionId)
  const baseUrl = connection.fhirBaseUrl.replace(/\/+$/, '')
  let url: string | undefined = `${baseUrl}/Patient?name=${encodeURIComponent(params.query)}`
  const counts: RosterUpsertCounts & { pages: number } = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    processed: 0,
    pages: 0,
  }
  let page = 0

  while (url) {
    page += 1
    counts.pages = page
    if (page % 20 === 0) {
      ;({ accessToken, connection } = await getBackendAccessToken(params.connectionId))
    }

    let response = await fetch(url, {
      headers: {
        accept: 'application/fhir+json',
        authorization: `Bearer ${accessToken}`,
      },
    })
    if (response.status === 401) {
      ;({ accessToken } = await getBackendAccessToken(params.connectionId))
      response = await fetch(url, {
        headers: {
          accept: 'application/fhir+json',
          authorization: `Bearer ${accessToken}`,
        },
      })
    }
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Patient name crawl failed (${response.status}) ${url}: ${text.slice(0, 400)}`)
    }

    const bundle = JSON.parse(text) as {
      entry?: Array<{ resource?: FhirPatient }>
      link?: Array<{ relation?: string; url?: string }>
    }
    for (const entry of bundle.entry || []) {
      const patient = entry.resource
      if (!patient?.id) continue
      if (params.seen.has(patient.id)) continue
      params.seen.add(patient.id)
      const result = await upsertFhirPatientForPractice(params.practiceId, patient)
      if (result === 'imported') counts.imported += 1
      else if (result === 'updated') counts.updated += 1
      else if (result === 'error') counts.errors += 1
      else counts.skipped += 1
      counts.processed += 1
    }

    url = (bundle.link || []).find((l) => l.relation === 'next')?.url
  }

  return counts
}

export function getEcwNameCrawlLetters() {
  return [...NAME_CRAWL_LETTERS]
}
