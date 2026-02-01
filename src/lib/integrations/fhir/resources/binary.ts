import { FhirClient, WriteNotSupportedError } from '../fhirClient'
import { supportsResourceInteraction } from '../capabilities'

export async function createBinary(params: {
  client: FhirClient
  contentType: string
  base64Data: string
  capabilityStatement: any
}) {
  if (!supportsResourceInteraction(params.capabilityStatement, 'Binary', 'create')) {
    throw new WriteNotSupportedError('Binary create not supported', [])
  }
  const payload = {
    resourceType: 'Binary',
    contentType: params.contentType,
    data: params.base64Data,
  }
  return params.client.request('/Binary', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
