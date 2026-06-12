import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Practice, User } from '@prisma/client'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'

export type AuthenticatedUser = User & { practice: Practice | null }

const getCachedSupabaseSession = cache(getSupabaseSession)

const syncSessionUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const session = await getCachedSupabaseSession()
  if (!session?.user) {
    return null
  }

  return syncSupabaseUserToPrisma(session.user)
})

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  try {
    return await syncSessionUser()
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    return null
  }
})

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const session = await getCachedSupabaseSession()

  if (!session) {
    redirect('/login')
  }

  try {
    const user = await syncSessionUser()
    if (!user) {
      redirect('/login?error=User account not found.')
    }
    return user
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const safeErrorMessage =
      errorMessage.length > 100 ? `${errorMessage.substring(0, 100)}...` : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
}

export async function requirePracticeUser(): Promise<AuthenticatedUser & { practiceId: string }> {
  const user = await requireAuthenticatedUser()
  if (!user.practiceId) {
    redirect('/login?error=Practice access required')
  }
  return user as AuthenticatedUser & { practiceId: string }
}
