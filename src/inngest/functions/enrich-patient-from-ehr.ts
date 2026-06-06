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

    const result = await enrichPatientFromEhr({
      practiceId,
      patientId,
      actorUserId: 'system',
      source: source || 'schedule_sync',
      force: force === true,
    })

    return { practiceId, patientId, result }
  }
)
