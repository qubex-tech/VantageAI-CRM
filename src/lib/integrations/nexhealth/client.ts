import {
  NEXHEALTH_API_VERSION,
  NEXHEALTH_BASE_URL,
  type NexhealthAppointment,
  type NexhealthEnvelope,
  type NexhealthEnvironment,
  type NexhealthInstitution,
  type NexhealthOperatory,
  type NexhealthPatient,
  type NexhealthProvider,
  type NexhealthSlotGroup,
} from './types'

const TOKEN_TTL_MS = 55 * 60 * 1000
const MAX_PAGES = 500

type TokenEntry = { token: string; expiresAt: number }
const tokenCache = new Map<NexhealthEnvironment, TokenEntry>()

export class NexhealthApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'NexhealthApiError'
    this.status = status
    this.body = body
  }
}

export function nexhealthApiKeyEnv(environment: NexhealthEnvironment): string {
  return environment === 'production' ? 'NEXHEALTH_API_KEY' : 'NEXHEALTH_SANDBOX_API_KEY'
}

export function isNexhealthKeyConfigured(environment: NexhealthEnvironment): boolean {
  return Boolean(process.env[nexhealthApiKeyEnv(environment)]?.trim())
}

export function getNexhealthApiKey(environment: NexhealthEnvironment): string {
  const name = nexhealthApiKeyEnv(environment)
  const key = process.env[name]?.trim()
  if (!key) {
    throw new Error(`${name} is not configured`)
  }
  return key
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorText(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as { error?: unknown; description?: unknown }
    const detail = record.error ?? record.description
    if (typeof detail === 'string' && detail.trim()) return detail
    if (detail != null) {
      try {
        return JSON.stringify(detail)
      } catch {
        return `NexHealth request failed (${status})`
      }
    }
  }
  return `NexHealth request failed (${status})`
}

type QueryValue = string | number | boolean | null | undefined | Array<string | number>

function appendQuery(url: URL, query?: Record<string, QueryValue>) {
  if (!query) return
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item))
      }
      continue
    }
    url.searchParams.set(key, String(value))
  }
}

async function authenticate(environment: NexhealthEnvironment, force = false): Promise<string> {
  const cached = tokenCache.get(environment)
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }
  const response = await fetch(`${NEXHEALTH_BASE_URL}/authenticates`, {
    method: 'POST',
    headers: {
      'Nex-Api-Version': NEXHEALTH_API_VERSION,
      Authorization: getNexhealthApiKey(environment),
      Accept: 'application/json',
    },
  })
  const json = (await response.json().catch(() => null)) as NexhealthEnvelope<{ token?: string }> | null
  const token = json?.data?.token
  if (!response.ok || json?.code === false || !token) {
    throw new NexhealthApiError(errorText(json, response.status), response.status, json)
  }
  tokenCache.set(environment, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  return token
}

export async function nexhealthRequest<T>(
  environment: NexhealthEnvironment,
  method: string,
  path: string,
  options?: { query?: Record<string, QueryValue>; body?: unknown }
): Promise<NexhealthEnvelope<T>> {
  let token = await authenticate(environment)
  let attempt = 0
  while (true) {
    const url = new URL(path.startsWith('http') ? path : `${NEXHEALTH_BASE_URL}${path}`)
    appendQuery(url, options?.query)
    const response = await fetch(url, {
      method,
      headers: {
        'Nex-Api-Version': NEXHEALTH_API_VERSION,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
    if (response.status === 401 && attempt === 0) {
      tokenCache.delete(environment)
      token = await authenticate(environment, true)
      attempt += 1
      continue
    }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1)
      await sleep(waitMs)
      attempt += 1
      continue
    }
    const json = (await response.json().catch(() => null)) as NexhealthEnvelope<T> | null
    if (!response.ok || json?.code === false) {
      throw new NexhealthApiError(errorText(json, response.status), response.status, json)
    }
    return json ?? { code: true, data: undefined }
  }
}

export async function nexhealthList<T>(
  environment: NexhealthEnvironment,
  path: string,
  query?: Record<string, QueryValue>
): Promise<T[]> {
  const out: T[] = []
  let cursor = ''
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const envelope = await nexhealthRequest<T[]>(environment, 'GET', path, {
      query: { ...query, per_page: 1000, ...(cursor ? { end_cursor: cursor } : {}) },
    })
    const rows = Array.isArray(envelope.data) ? envelope.data : []
    out.push(...rows)
    if (!envelope.page_info?.has_next_page) break
    const next = envelope.page_info.end_cursor
    if (!next || next === cursor) break
    cursor = next
  }
  return out
}

function asLocations(value: unknown): NexhealthInstitution['locations'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const id = Number((item as { id?: unknown }).id)
      if (!Number.isInteger(id) || id <= 0) return null
      const name = (item as { name?: unknown }).name
      return { id, name: typeof name === 'string' ? name : null }
    })
    .filter((item): item is { id: number; name: string | null } => item !== null)
}

export async function listNexhealthInstitutions(
  environment: NexhealthEnvironment
): Promise<NexhealthInstitution[]> {
  const rows = await nexhealthList<NexhealthInstitution>(environment, '/institutions')
  return rows
    .map((row) => ({
      id: Number(row.id),
      name: row.name ?? null,
      subdomain: String(row.subdomain || '').trim(),
      locations: asLocations(row.locations),
    }))
    .filter((row) => row.subdomain && Number.isInteger(row.id))
}

export async function listNexhealthPatients(
  environment: NexhealthEnvironment,
  query: Record<string, QueryValue>
): Promise<NexhealthPatient[]> {
  return nexhealthList<NexhealthPatient>(environment, '/patients', {
    location_strict: true,
    non_patient: false,
    ...query,
  })
}

export async function getNexhealthPatient(
  environment: NexhealthEnvironment,
  patientId: number,
  subdomain: string
): Promise<NexhealthPatient | null> {
  const envelope = await nexhealthRequest<NexhealthPatient>(environment, 'GET', `/patients/${patientId}`, {
    query: { subdomain },
  })
  const data = envelope.data
  if (!data || typeof data !== 'object') return null
  if (typeof (data as NexhealthPatient).id === 'number') return data
  const nested = (data as { patient?: NexhealthPatient }).patient
  return nested?.id ? nested : null
}

export async function createNexhealthPatient(
  environment: NexhealthEnvironment,
  query: { subdomain: string; locationId: number },
  body: {
    providerId: number
    firstName: string
    lastName: string
    email: string
    phone: string
    dateOfBirth: string
    gender?: string | null
  }
): Promise<NexhealthPatient> {
  const envelope = await nexhealthRequest<NexhealthPatient | { patient?: NexhealthPatient; user?: NexhealthPatient }>(
    environment,
    'POST',
    '/patients',
    {
      query: { subdomain: query.subdomain, location_id: query.locationId },
      body: {
        return_existing_if_match: true,
        provider: { provider_id: body.providerId },
        patient: {
          first_name: body.firstName,
          last_name: body.lastName,
          email: body.email,
          bio: {
            phone_number: body.phone,
            date_of_birth: body.dateOfBirth,
            ...(body.gender ? { gender: body.gender } : {}),
          },
        },
      },
    }
  )
  const data = envelope.data
  if (data && typeof data === 'object' && 'id' in data && (data as NexhealthPatient).id) {
    return data as NexhealthPatient
  }
  const nested =
    data && typeof data === 'object'
      ? ((data as { patient?: NexhealthPatient }).patient ?? (data as { user?: NexhealthPatient }).user)
      : null
  if (nested?.id) return nested
  throw new NexhealthApiError('NexHealth did not return a patient id', 502, envelope)
}

export async function listNexhealthProviders(
  environment: NexhealthEnvironment,
  subdomain: string,
  locationId: number
): Promise<NexhealthProvider[]> {
  return nexhealthList<NexhealthProvider>(environment, '/providers', {
    subdomain,
    location_id: locationId,
  })
}

export async function listNexhealthOperatories(
  environment: NexhealthEnvironment,
  subdomain: string,
  locationId: number
): Promise<NexhealthOperatory[]> {
  return nexhealthList<NexhealthOperatory>(environment, '/operatories', {
    subdomain,
    location_id: locationId,
  })
}

export async function listNexhealthAppointments(
  environment: NexhealthEnvironment,
  query: Record<string, QueryValue>
): Promise<NexhealthAppointment[]> {
  return nexhealthList<NexhealthAppointment>(environment, '/appointments', {
    unavailable: false,
    ...query,
  })
}

export async function createNexhealthAppointment(
  environment: NexhealthEnvironment,
  query: { subdomain: string; locationId: number },
  appt: {
    patientId: number
    providerId: number
    operatoryId?: number | null
    startTime: string
    endTime: string
    note?: string | null
  }
): Promise<NexhealthAppointment> {
  const envelope = await nexhealthRequest<{ appt?: NexhealthAppointment } | NexhealthAppointment>(
    environment,
    'POST',
    '/appointments',
    {
      query: {
        subdomain: query.subdomain,
        location_id: query.locationId,
        notify_patient: false,
      },
      body: {
        appt: {
          patient_id: appt.patientId,
          provider_id: appt.providerId,
          ...(appt.operatoryId ? { operatory_id: appt.operatoryId } : {}),
          start_time: appt.startTime,
          end_time: appt.endTime,
          ...(appt.note ? { note: appt.note } : {}),
        },
      },
    }
  )
  const data = envelope.data
  const created =
    data && typeof data === 'object' && 'appt' in data
      ? (data as { appt?: NexhealthAppointment }).appt
      : (data as NexhealthAppointment | undefined)
  if (!created?.id) {
    throw new NexhealthApiError('NexHealth did not return an appointment id', 502, envelope)
  }
  return created
}

export async function patchNexhealthAppointment(
  environment: NexhealthEnvironment,
  subdomain: string,
  appointmentId: number,
  appt: { cancelled?: boolean; confirmed?: boolean }
): Promise<void> {
  await nexhealthRequest(environment, 'PATCH', `/appointments/${appointmentId}`, {
    query: { subdomain },
    body: { appt },
  })
}

export async function listNexhealthAvailableSlots(
  environment: NexhealthEnvironment,
  query: {
    subdomain: string
    startDate: string
    days: number
    locationId: number
    providerIds: number[]
    operatoryIds?: number[]
    slotLength: number
  }
): Promise<NexhealthSlotGroup[]> {
  const envelope = await nexhealthRequest<NexhealthSlotGroup[]>(environment, 'GET', '/available_slots', {
    query: {
      subdomain: query.subdomain,
      start_date: query.startDate,
      days: query.days,
      'lids[]': [query.locationId],
      'pids[]': query.providerIds,
      ...(query.operatoryIds && query.operatoryIds.length > 0
        ? { 'operatory_ids[]': query.operatoryIds }
        : {}),
      slot_length: query.slotLength,
    },
  })
  return Array.isArray(envelope.data) ? envelope.data : []
}

export async function getNexhealthSyncStatus(
  environment: NexhealthEnvironment,
  subdomain: string
): Promise<unknown> {
  const envelope = await nexhealthRequest<unknown>(environment, 'GET', '/sync_status', {
    query: { subdomain },
  })
  return envelope.data
}

export type NexhealthWebhookEndpoint = {
  id: number | string
  secret_key?: string | null
}

export async function registerNexhealthWebhookEndpoint(
  environment: NexhealthEnvironment,
  targetUrl: string
): Promise<NexhealthWebhookEndpoint> {
  const envelope = await nexhealthRequest<NexhealthWebhookEndpoint>(environment, 'POST', '/webhook_endpoints', {
    body: { target_url: targetUrl },
  })
  const data = envelope.data
  if (!data?.id) {
    throw new NexhealthApiError('NexHealth did not return a webhook endpoint id', 502, envelope)
  }
  return data
}

export async function createNexhealthWebhookSubscription(
  environment: NexhealthEnvironment,
  endpointId: string,
  subdomain: string,
  resourceType: string,
  event: string
): Promise<void> {
  await nexhealthRequest(environment, 'POST', `/webhook_endpoints/${endpointId}/webhook_subscriptions`, {
    query: { subdomain },
    body: { resource_type: resourceType, event },
  })
}
