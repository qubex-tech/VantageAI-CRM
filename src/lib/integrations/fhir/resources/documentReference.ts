import { FhirClient, WriteNotSupportedError } from '../fhirClient'
import { supportsResourceInteraction } from '../capabilities'
import { createBinary } from './binary'

export async function createDraftDocumentReference(params: {
  client: FhirClient
  patientId: string
  noteText: string
  authorReference?: string
  preferPreliminary?: boolean
  requireBinary?: boolean
  capabilityStatement: any
}) {
  if (!supportsResourceInteraction(params.capabilityStatement, 'DocumentReference', 'create')) {
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

  const created = (await params.client.request('/DocumentReference', {
    method: 'POST',
    body: JSON.stringify(resource),
  })) as any

  const id = created?.id
  const reviewUrl = id ? `${params.client.getBaseUrl()}/DocumentReference/${id}` : undefined
  return { id, reviewUrl, resource: created }
}
