import { FhirClient, WriteNotSupportedError } from '../fhirClient'
import { supportsResourceInteraction } from '../capabilities'

export type PatientInput = {
  name: {
    given: string[]
    family?: string
    text?: string
  }
  telecom?: Array<{ system: 'phone' | 'email'; value: string; use?: string }>
  gender?: string
  birthDate?: string
  address?: {
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  identifiers?: Array<{ system?: string; value: string }>
}

export async function getPatient(client: FhirClient, patientId: string) {
  return client.request(`/Patient/${patientId}`)
}

export async function searchPatients(client: FhirClient, query: Record<string, string>) {
  const params = new URLSearchParams(query)
  return client.request(`/Patient?${params.toString()}`)
}

export async function createPatient(
  client: FhirClient,
  input: PatientInput,
  capabilityStatement: any
) {
  if (!supportsResourceInteraction(capabilityStatement, 'Patient', 'create')) {
    throw new WriteNotSupportedError('Patient create not supported', [])
  }
  const resource: any = {
    resourceType: 'Patient',
    name: [
      {
        given: input.name.given,
        family: input.name.family,
        text: input.name.text,
      },
    ],
    gender: input.gender,
    birthDate: input.birthDate,
    address: input.address ? [input.address] : undefined,
    telecom: input.telecom,
    identifier: input.identifiers,
  }
  return client.request('/Patient', { method: 'POST', body: JSON.stringify(resource) })
}
