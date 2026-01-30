import { prisma } from '@/lib/db'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'

export type SmartFhirSettings = {
  enabled: boolean
  issuer?: string
  fhirBaseUrl?: string
  clientId?: string
  enableWrite?: boolean
  enablePatientCreate?: boolean
  enableNoteCreate?: boolean
}

export async function requireSmartUser() {
  const session = await getSupabaseSession()
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  const user = await syncSupabaseUserToPrisma(session.user)
  if (!user?.practiceId) {
    throw new Error('User is missing practice context')
  }
  return {
    user,
    practiceId: user.practiceId,
  }
}

export async function resolveSmartPractice(practiceIdOverride?: string) {
  const session = await getSupabaseSession()
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  const user = await syncSupabaseUserToPrisma(session.user)
  if (!user) {
    throw new Error('User not found')
  }

  if (practiceIdOverride) {
    if (!canConfigureAPIs({
      id: user.id,
      email: user.email,
      name: user.name,
      practiceId: user.practiceId,
      role: user.role,
    })) {
      throw new Error('Permission denied')
    }
    return { user, practiceId: practiceIdOverride }
  }

  if (!user.practiceId) {
    throw new Error('User is missing practice context')
  }
  return { user, practiceId: user.practiceId }
}

export async function getSmartSettings(practiceId: string): Promise<SmartFhirSettings | null> {
  const settings = await prisma.practiceSettings.findUnique({
    where: { practiceId },
  })
  if (!settings?.smartFhir) {
    return null
  }
  return settings.smartFhir as SmartFhirSettings
}

export async function upsertSmartSettings(practiceId: string, smartFhir: SmartFhirSettings) {
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    update: { smartFhir },
    create: {
      practiceId,
      smartFhir,
    },
  })
}

export function getSmartDefaultScopes() {
  const envScopes = process.env.SMART_DEFAULT_SCOPES
  if (envScopes) {
    return envScopes
  }
  return 'openid fhirUser profile offline_access patient/Patient.read patient/DocumentReference.read'
}

export function getIssuerAllowlist(): string[] {
  const allowlist = process.env.SMART_ISSUER_ALLOWLIST
  if (!allowlist) {
    return []
  }
  return allowlist
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function isIssuerAllowed(issuer: string): boolean {
  const allowlist = getIssuerAllowlist()
  if (allowlist.length === 0) {
    return true
  }
  return allowlist.includes(issuer)
}

export function shouldEnableWrite(settings: SmartFhirSettings | null) {
  const globalEnable = process.env.SMART_ENABLE_WRITE === 'true'
  if (!globalEnable) {
    return false
  }
  return settings?.enableWrite === true
}
