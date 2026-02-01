import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'
import { EhrSettings } from './types'

export async function resolveEhrPractice(practiceIdOverride?: string) {
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

export async function getEhrSettings(practiceId: string): Promise<EhrSettings | null> {
  const settings = await prisma.practiceSettings.findUnique({
    where: { practiceId },
  })
  if (!settings?.ehrIntegrations) {
    return null
  }
  return settings.ehrIntegrations as EhrSettings
}

export async function upsertEhrSettings(practiceId: string, ehrIntegrations: EhrSettings) {
  const settingsJson = Object.keys(ehrIntegrations).length
    ? (ehrIntegrations as Prisma.InputJsonValue)
    : Prisma.JsonNull
  return prisma.practiceSettings.upsert({
    where: { practiceId },
    update: { ehrIntegrations: settingsJson },
    create: {
      practiceId,
      ehrIntegrations: settingsJson,
    },
  })
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
