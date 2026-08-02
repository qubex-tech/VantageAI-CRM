import { ENDPOINTS } from '@/constants/api'
import { apiGet } from '@/services/apiClient'
import type { PatientProfile, PatientSummary } from '@/types'

export async function searchPatients(search: string, limit = 20): Promise<{ patients: PatientSummary[] }> {
  return apiGet(ENDPOINTS.mobilePatients, {
    search: search.trim() || undefined,
    limit,
  })
}

export async function fetchPatientProfile(id: string): Promise<{ patient: PatientProfile }> {
  return apiGet(ENDPOINTS.mobilePatientById(id))
}

export function patientPhone(patient: Pick<PatientSummary, 'phone' | 'primaryPhone'>): string | null {
  return patient.primaryPhone || patient.phone || null
}
