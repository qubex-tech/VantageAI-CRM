import { FhirClient, WriteNotSupportedError } from '../fhirClient'
import { supportsResourceInteraction } from '../capabilities'
import { createBinary } from './binary'

function extractResourceIdFromLocation(
  location: string | undefined,
  resourceType: 'DocumentReference'
): string | undefined {
  if (!location) return undefined
  const marker = `/${resourceType}/`
  const markerIndex = location.indexOf(marker)
  if (markerIndex >= 0) {
    const remainder = location.slice(markerIndex + marker.length)
    const id = remainder.split('/')[0]
    return id || undefined
  }
  const trimmed = location.replace(/^\/+/, '')
  const segments = trimmed.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((segment) => segment === resourceType)
  if (typeIndex >= 0 && segments[typeIndex + 1]) {
    return segments[typeIndex + 1]
  }
  return undefined
}

export async function createDraftDocumentReference(params: {
  client: FhirClient
  patientId: string
  noteText: string
  authorReference?: string
  preferPreliminary?: boolean
  requireBinary?: boolean
  capabilityStatement: any
  skipCapabilityCheck?: boolean
  useTransaction?: boolean
}) {
  if (
    !params.skipCapabilityCheck &&
    !supportsResourceInteraction(params.capabilityStatement, 'DocumentReference', 'create')
  ) {
    throw new WriteNotSupportedError('DocumentReference create not supported', [])
  }

  const noteData = Buffer.from(params.noteText, 'utf8').toString('base64')
  let attachment: any = {
    contentType: 'text/plain',
    data: noteData,
  }

  if (params.requireBinary) {
    const binary = await createBinary({
      client: params.client,
      contentType: 'text/plain',
      base64Data: noteData,
      capabilityStatement: params.capabilityStatement,
    })
    if ((binary as any)?.id) {
      attachment = {
        contentType: 'text/plain',
        url: `Binary/${(binary as any).id}`,
        title: 'AI Generated Draft Note',
      }
    }
  }

  const status = params.preferPreliminary ? 'preliminary' : 'current'
  const resource: any = {
    resourceType: 'DocumentReference',
    status,
    type: { text: 'Clinical note' },
    category: [{ text: 'Telephone encounter' }],
    subject: { reference: `Patient/${params.patientId}` },
    date: new Date().toISOString(),
    description:
      'AI-generated draft note created by Vantage AI; requires clinician review and signature.',
    content: [{ attachment }],
  }

  if (!params.preferPreliminary) {
    resource.title = 'DRAFT - AI Generated Note'
  }

  if (params.authorReference) {
    resource.author = [{ reference: params.authorReference }]
  }

  if (params.useTransaction) {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          resource,
          request: {
            method: 'POST',
            url: 'DocumentReference',
          },
        },
      ],
    }
    const response = (await params.client.request('/', {
      method: 'POST',
      body: JSON.stringify(bundle),
    })) as any
    const location = response?.entry?.[0]?.response?.location as string | undefined
    const id = extractResourceIdFromLocation(location, 'DocumentReference')
    const reviewUrl = id ? `${params.client.getBaseUrl()}/DocumentReference/${id}` : undefined
    return { id, reviewUrl, resource: response }
  }

  const created = (await params.client.request('/DocumentReference', {
    method: 'POST',
    body: JSON.stringify(resource),
  })) as any

  const id = created?.id
  const reviewUrl = id ? `${params.client.getBaseUrl()}/DocumentReference/${id}` : undefined
  return { id, reviewUrl, resource: created }
}
