import { prisma } from '@/lib/db'
import { syncNexhealthAppointments } from './appointmentSync'
import { getNexhealthSyncStatus } from './client'
import {
  asNexhealthEnvironment,
  recordNexhealthSyncResult,
  summarizeNexhealthSyncStatus,
} from './connection'
import { nexhealthUpdatedSince } from './mapping'
import { syncNexhealthPatients } from './patientSync'

export type NexhealthPracticeSyncResult = {
  practiceId: string
  status: 'success' | 'partial' | 'error'
  patients?: Awaited<ReturnType<typeof syncNexhealthPatients>>
  appointments?: Awaited<ReturnType<typeof syncNexhealthAppointments>>
  error?: string
}

export async function syncNexhealthPractice(practiceId: string): Promise<NexhealthPracticeSyncResult> {
  const connection = await prisma.nexHealthConnection.findUnique({ where: { practiceId } })
  if (!connection || !connection.isActive) {
    throw new Error('NexHealth is not connected for this practice')
  }
  const startedAt = new Date()
  const updatedSince = nexhealthUpdatedSince(connection.lastSuccessfulSyncAt)
  try {
    const patients = await syncNexhealthPatients({ connection, updatedSince })
    const appointments = await syncNexhealthAppointments({ connection })
    let readStatus: string | null = null
    let writeStatus: string | null = null
    try {
      const status = await getNexhealthSyncStatus(
        asNexhealthEnvironment(connection.environment),
        connection.subdomain
      )
      const summarized = summarizeNexhealthSyncStatus(status)
      readStatus = summarized.readStatus
      writeStatus = summarized.writeStatus
    } catch (error) {
      console.error('[NexHealth] sync status lookup failed', error)
    }
    const failed = patients.errors + appointments.errors
    const status = failed > 0 ? 'partial' : 'success'
    const error =
      failed > 0
        ? [...patients.errorSamples, ...appointments.errorSamples].slice(0, 3).join('; ')
        : null
    await recordNexhealthSyncResult(practiceId, {
      status,
      error,
      completedAt: startedAt,
      readStatus,
      writeStatus,
    })
    return { practiceId, status, patients, appointments }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'NexHealth sync failed'
    await recordNexhealthSyncResult(practiceId, { status: 'error', error: message }).catch(() => undefined)
    return { practiceId, status: 'error', error: message }
  }
}

export async function syncAllNexhealthConnections(): Promise<{
  totalPractices: number
  results: NexhealthPracticeSyncResult[]
}> {
  const connections = await prisma.nexHealthConnection.findMany({
    where: { isActive: true },
    select: { practiceId: true },
  })
  const results: NexhealthPracticeSyncResult[] = []
  for (const connection of connections) {
    results.push(await syncNexhealthPractice(connection.practiceId))
  }
  return { totalPractices: connections.length, results }
}
