import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { canConfigureAPIs } from '@/lib/permissions'

export async function resolveOpenDentalPractice(practiceIdOverride?: string) {
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

export function getDeveloperKey(): string {
  const key = process.env.OPEN_DENTAL_DEVELOPER_KEY?.trim()
  if (!key) {
    throw new Error('OPEN_DENTAL_DEVELOPER_KEY is not configured')
  }
  return key
}

export function getDefaultBaseUrl(): string {
  return process.env.OPEN_DENTAL_DEFAULT_BASE_URL?.trim() || 'https://api.opendental.com/api/v1'
}
