import { prisma } from '@/lib/db'
import { decryptString, encryptString } from '@/lib/integrations/ehr/crypto'
import type { NexHealthConnection } from '@prisma/client'
import { upsertAppointmentFromNexhealth } from './appointmentSync'
import {
  createNexhealthWebhookSubscription,
  registerNexhealthWebhookEndpoint,
} from './client'
import { asNexhealthEnvironment, summarizeNexhealthSyncStatus } from './connection'
import { verifyNexhealthWebhookSignature } from './mapping'
import { upsertPatientFromNexhealth } from './patientSync'
import type { NexhealthAppointment, NexhealthEnvironment, NexhealthPatient, NexhealthWebhookPayload } from './types'

const SUBSCRIPTIONS: Array<{ resourceType: string; event: string }> = [
  { resourceType: 'Patient', event: 'patient_created' },
  { resourceType: 'Patient', event: 'patient_updated' },
  { resourceType: 'Appointment', event: 'appointment_created' },
  { resourceType: 'Appointment', event: 'appointment_updated' },
  { resourceType: 'Appointment', event: 'appointment_insertion' },
  { resourceType: 'SyncStatus', event: 'sync_status_read_change' },
  { resourceType: 'SyncStatus', event: 'sync_status_write_change' },
]

function webhookTargetUrl(): string {
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  if (!base) {
    throw new Error('APP_BASE_URL is not configured')
  }
  return `${base}/api/integrations/nexhealth/webhook`
}

export async function listNexhealthWebhookSecrets(): Promise<string[]> {
  const rows = await prisma.nexHealthAppCredential.findMany({
    where: { webhookSecretEncrypted: { not: null } },
    select: { webhookSecretEncrypted: true },
  })
  const secrets: string[] = []
  for (const row of rows) {
    if (!row.webhookSecretEncrypted) continue
    try {
      secrets.push(decryptString(row.webhookSecretEncrypted))
    } catch (error) {
      console.error('[NexHealth webhook] Failed to decrypt endpoint secret', error)
    }
  }
  return secrets
}

export function nexhealthSignatureMatches(params: {
  rawBody: string
  timestamp: string
  signature: string
  secrets: string[]
}): boolean {
  return params.secrets.some((secret) =>
    verifyNexhealthWebhookSignature({
      rawBody: params.rawBody,
      timestamp: params.timestamp,
      signature: params.signature,
      secret,
    })
  )
}

export async function ensureNexhealthWebhookEndpoint(
  environment: NexhealthEnvironment
): Promise<{ endpointId: string; created: boolean }> {
  const existing = await prisma.nexHealthAppCredential.findUnique({ where: { environment } })
  if (existing?.webhookEndpointId && existing.webhookSecretEncrypted) {
    return { endpointId: existing.webhookEndpointId, created: false }
  }
  const created = await registerNexhealthWebhookEndpoint(environment, webhookTargetUrl())
  if (!created.secret_key) {
    throw new Error('NexHealth webhook endpoint did not include a secret key')
  }
  const saved = await prisma.nexHealthAppCredential.upsert({
    where: { environment },
    create: {
      environment,
      webhookEndpointId: String(created.id),
      webhookSecretEncrypted: encryptString(created.secret_key),
    },
    update: {
      webhookEndpointId: String(created.id),
      webhookSecretEncrypted: encryptString(created.secret_key),
    },
  })
  return { endpointId: saved.webhookEndpointId || String(created.id), created: true }
}

export async function subscribeNexhealthPractice(connection: NexHealthConnection): Promise<string[]> {
  const environment = asNexhealthEnvironment(connection.environment)
  const { endpointId } = await ensureNexhealthWebhookEndpoint(environment)
  const warnings: string[] = []
  for (const subscription of SUBSCRIPTIONS) {
    try {
      await createNexhealthWebhookSubscription(
        environment,
        endpointId,
        connection.subdomain,
        subscription.resourceType,
        subscription.event
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'subscription failed'
      if (/already/i.test(message) || /exist/i.test(message)) continue
      warnings.push(`${subscription.event}: ${message}`)
    }
  }
  return warnings
}

async function findConnection(
  subdomain: string,
  locationId: number | null | undefined
): Promise<NexHealthConnection | null> {
  if (locationId && locationId > 0) {
    return prisma.nexHealthConnection.findFirst({
      where: { subdomain, locationId, isActive: true },
    })
  }
  const rows = await prisma.nexHealthConnection.findMany({
    where: { subdomain, isActive: true },
    take: 2,
  })
  return rows.length === 1 ? rows[0] : null
}

function asPatient(value: unknown): NexhealthPatient | null {
  if (!value || typeof value !== 'object') return null
  const id = Number((value as { id?: unknown }).id)
  if (!Number.isInteger(id) || id <= 0) return null
  return value as NexhealthPatient
}

function asAppointment(value: unknown): NexhealthAppointment | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { id?: unknown; patient_id?: unknown; start_time?: unknown }
  const id = Number(record.id)
  const patientId = Number(record.patient_id)
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(patientId) || patientId <= 0) return null
  if (typeof record.start_time !== 'string') return null
  return value as NexhealthAppointment
}

function numericId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function handleNexhealthWebhook(payload: NexhealthWebhookPayload): Promise<void> {
  const subdomain = payload.subdomain?.trim()
  if (!subdomain) return
  const eventName = payload.event_name || ''
  const data = payload.data ?? {}

  if (eventName.startsWith('sync_status_')) {
    const status = summarizeNexhealthSyncStatus(data.sync_status ?? data)
    await prisma.nexHealthConnection.updateMany({
      where: { subdomain, isActive: true },
      data: {
        ...(status.readStatus ? { syncReadStatus: status.readStatus } : {}),
        ...(status.writeStatus ? { syncWriteStatus: status.writeStatus } : {}),
      },
    })
    return
  }

  if ((payload.resource_type || '').toLowerCase() === 'patient' || eventName.startsWith('patient_')) {
    const patientSource = Array.isArray(data.patients) ? data.patients[0] : data.patient ?? data.patients
    const patient = asPatient(patientSource)
    if (!patient) return
    const locationId = numericId(patient.location_id ?? data.location_id)
    const connection = await findConnection(subdomain, locationId)
    if (!connection) return
    await upsertPatientFromNexhealth({ practiceId: connection.practiceId, patient })
    return
  }

  const appointmentSource = Array.isArray(data.appointments)
    ? data.appointments[0]
    : data.appointment ?? data.appt ?? data.appointments
  const appointment = asAppointment(appointmentSource)
  if (!appointment) return
  const connection = await findConnection(subdomain, numericId(appointment.location_id ?? data.location_id))
  if (!connection) return
  await upsertAppointmentFromNexhealth({ connection, appointment })
}
