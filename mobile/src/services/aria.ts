import { ENDPOINTS } from '@/constants/api'
import { apiGet, apiPost, getApiClient } from '@/services/apiClient'
import type { AriaScheduleAppointment, AriaSession, AriaSoapNote } from '@/types'

export async function fetchMobileFeatures(): Promise<{ ariaScribeEnabled: boolean }> {
  return apiGet<{ ariaScribeEnabled: boolean }>(ENDPOINTS.mobileFeatures)
}

export async function fetchAriaSchedule(date?: string): Promise<{
  date: string
  appointments: AriaScheduleAppointment[]
}> {
  return apiGet(ENDPOINTS.ariaSchedule, date ? { date } : undefined)
}

export async function fetchAriaSessions(params?: {
  patientId?: string
  status?: string
}): Promise<{ sessions: AriaSession[] }> {
  return apiGet(ENDPOINTS.ariaSessions, params)
}

export async function fetchAriaSession(id: string): Promise<{ session: AriaSession }> {
  return apiGet(ENDPOINTS.ariaSessionById(id))
}

export async function createAriaSession(payload: {
  patientId: string
  appointmentId?: string | null
  mode?: 'ambient' | 'dictation' | 'hybrid'
  consent: true
}): Promise<{ session: AriaSession }> {
  return apiPost(ENDPOINTS.ariaSessions, payload)
}

export async function uploadAriaChunk(params: {
  sessionId: string
  uri: string
  kind: 'ambient' | 'dictation'
  durationMs?: number
  mimeType?: string
}): Promise<void> {
  const form = new FormData()
  form.append('file', {
    uri: params.uri,
    name: `aria-${params.kind}.m4a`,
    type: params.mimeType || 'audio/m4a',
  } as unknown as Blob)
  form.append('kind', params.kind)
  if (params.durationMs != null) {
    form.append('durationMs', String(params.durationMs))
  }

  const client = getApiClient()
  await client.post(ENDPOINTS.ariaSessionChunks(params.sessionId), form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

export async function stopAriaSession(sessionId: string): Promise<{ session: AriaSession }> {
  return apiPost(ENDPOINTS.ariaSessionStop(sessionId))
}

export async function patchAriaNote(
  sessionId: string,
  soap: Partial<AriaSoapNote>
): Promise<{ session: AriaSession }> {
  const client = getApiClient()
  const res = await client.patch<{ session: AriaSession }>(ENDPOINTS.ariaSessionNote(sessionId), soap)
  return res.data
}

export async function signAriaSession(sessionId: string): Promise<{ session: AriaSession }> {
  return apiPost(ENDPOINTS.ariaSessionSign(sessionId))
}

export async function discardAriaSession(sessionId: string): Promise<{ session: AriaSession }> {
  return apiPost(ENDPOINTS.ariaSessionDiscard(sessionId))
}
