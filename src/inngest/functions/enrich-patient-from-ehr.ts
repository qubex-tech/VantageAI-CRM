import { inngest } from '../client'
import { enrichPatientFromEhr, type EnrichPatientSource } from '@/lib/integrations/ehr/enrichPatientFromEhr'

export const enrichPatientFromEhrJob = inngest.createFunction(
  {
    id: 'enrich-patient-from-ehr',
    name: 'Enrich Patient from eCW',
    retries: 2,
    concurrency: {
      limit: 3,
      key: 'event.data.practiceId',
    },
  },
  { event: 'ehr/patient.enrich' },
  async ({ event }) => {
    const { practiceId, patientId, source, force } = event.data as {
      practiceId: string
      patientId: string
      source?: EnrichPatientSource
      force?: boolean
    }

    if (!practiceId || !patientId) {
      return { error: 'Missing practiceId or patientId' }
    }

    const resolvedSource = source || 'schedule_sync'
    const result = await enrichPatientFromEhr({
      practiceId,
      patientId,
      actorUserId: 'system',
      source: resolvedSource,
      force: force === true || resolvedSource === 'schedule_sync',
      skipIfFreshWithinHours: resolvedSource === 'schedule_sync' ? null : undefined,
    })

    return { practiceId, patientId, result }
  }
)
