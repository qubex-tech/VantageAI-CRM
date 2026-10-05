import { ENDPOINTS } from '@/constants/api'
import { apiGet, apiPost, getApiErrorMessage } from '@/services/apiClient'
import { isAxiosError } from 'axios'

export type GlassesCard = {
  id: 'glance' | 'alerts' | 'lastVisit'
  title: string
  lines: [string, string, string]
}

export type GlassesContext = {
  mode: 'demo' | 'phi'
  phiAllowed: boolean
  patientLabel: string
  cards: GlassesCard[]
  notice: string
}

export type GlassesAskResult = {
  answer: string
  model: 'local' | 'openai' | 'muse'
  modelBlocked?: 'openai' | 'muse'
}

export async function fetchGlassesContext(patientId: string): Promise<GlassesContext> {
  return apiGet<GlassesContext>(ENDPOINTS.mobilePatientGlasses(patientId))
}

export async function askGlasses(patientId: string, question: string): Promise<GlassesAskResult> {
  return apiPost<GlassesAskResult>(ENDPOINTS.mobilePatientGlassesAsk(patientId), { question })
}

export function isAddendumRequired(err: unknown): boolean {
  return isAxiosError(err) && err.response?.data?.code === 'HEALTHCARE_ADDENDUM_REQUIRED'
}

export function glassesErrorMessage(err: unknown, fallback: string): string {
  return getApiErrorMessage(err, fallback)
}
