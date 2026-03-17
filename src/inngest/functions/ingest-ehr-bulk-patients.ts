import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'

type BulkImportEvent = {
  data: {
    practiceId: string
    providerId: string
    statusUrl?: string
    outputUrls?: string[]
  }
}

type FhirPatient = {
  resourceType?: string
  id?: string
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

function buildFullName(patient: FhirPatient) {
  const name = patient.name?.[0]
  const given = name?.given?.[0] || ''
  const family = name?.family || ''
  return [given, family].filter(Boolean).join(' ').trim()
}

function mapPatientRecord(patient: FhirPatient) {
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
    firstName: patient.name?.[0]?.given?.[0] || null,
    lastName: patient.name?.[0]?.family || null,
    name: name || null,
    dateOfBirth: patient.birthDate ? new Date(patient.birthDate) : null,
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
    preferredContactMethod: null,
    consentSource: null,
  }
}

function mergeUpdate<T extends Record<string, any>>(current: T, incoming: T) {
  const update: Partial<T> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined || value === '') {
      continue
    }
    if (current[key as keyof T] !== value) {
      update[key as keyof T] = value as T[keyof T]
    }
  }
  return update
}

async function fetchOutputUrls(statusUrl: string, accessToken: string) {
  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Bulk status fetch failed: ${text}`)
  }
  const parsed = text ? JSON.parse(text) : null
  const outputs = Array.isArray(parsed?.output) ? parsed.output : []
  return outputs
    .filter((item: any) => item?.type === 'Patient' && typeof item?.url === 'string')
    .map((item: any) => item.url as string)
}

async function downloadPatients(url: string, accessToken: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/fhir+ndjson, application/ndjson, application/json',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Bulk file download failed: ${text}`)
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FhirPatient)
}

export const ingestEhrBulkPatients = inngest.createFunction(
  {
    id: 'ingest-ehr-bulk-patients',
    name: 'Ingest EHR Bulk Patients',
  },
  { event: 'ehr/bulk.import' },
  async ({ event, step }) => {
    const { practiceId, providerId, statusUrl, outputUrls } = event.data as BulkImportEvent['data']
    if (!practiceId || !providerId) {
      throw new Error('Missing practiceId or providerId')
    }

    const connection = await step.run('load-connection', async () => {
      const connections = await prisma.ehrConnection.findMany({
        where: { tenantId: practiceId, providerId },
        orderBy: { updatedAt: 'desc' },
      })
      return connections.find((candidate) => candidate.authFlow === 'backend_services') || null
    })
    if (!connection?.accessTokenEnc) {
      throw new Error('No backend services connection available')
    }

    const refreshed = await step.run('refresh-token', async () => {
      const fresh = await prisma.ehrConnection.findUnique({
        where: { id: connection.id },
      })
      if (!fresh) {
        throw new Error('Backend services connection not found')
      }
      return refreshBackendConnectionIfNeeded({ connection: fresh })
    })
    const accessToken = decryptString(refreshed.accessTokenEnc!)

    const patientUrls = await step.run('resolve-output-urls', async () => {
      if (outputUrls && outputUrls.length) {
        return outputUrls
      }
      if (!statusUrl) {
        throw new Error('statusUrl or outputUrls is required')
      }
      return fetchOutputUrls(statusUrl, accessToken)
    })

    let imported = 0
    let updated = 0
    let skipped = 0

    for (const url of patientUrls) {
      const patients = await step.run(`download-${url}`, async () => {
        return downloadPatients(url, accessToken)
      })

      for (const patient of patients) {
        if (patient.resourceType !== 'Patient' || !patient.id) {
          skipped += 1
          continue
        }
        const mapped = mapPatientRecord(patient)
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
          imported += 1
          continue
        }
        const update = mergeUpdate(existing as any, mapped as any)
        if (Object.keys(update).length > 0) {
          await prisma.patient.update({
            where: { id: existing.id },
            data: update,
          })
          updated += 1
        } else {
          skipped += 1
        }
      }
    }

    await logEhrAudit({
      tenantId: practiceId,
      actorUserId: null,
      action: 'EHR_BULK_IMPORT_COMPLETE',
      providerId,
      entity: 'EhrConnection',
      entityId: connection.id,
      metadata: {
        imported,
        updated,
        skipped,
        files: patientUrls.length,
      },
    })

    return {
      imported,
      updated,
      skipped,
      files: patientUrls.length,
    }
  }
)
