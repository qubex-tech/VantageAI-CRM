import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { AutomationsPage } from '@/components/settings/AutomationsPage'

export const dynamic = 'force-dynamic'

export default async function AutomationsSettingsPage() {
  const supabaseSession = await getSupabaseSession()
  
  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    redirect('/login')
  }
  
  if (!user || !user.practiceId) {
    redirect('/login?error=Practice access required')
  }

  type SerializedRule = {
    id: string
    practiceId: string
    name: string
    enabled: boolean
    triggerEvent: string
    conditionsJson: any
    actionsJson: any[]
    createdByUserId: string
    createdAt: string
    updatedAt: string
    _count?: {
      runs: number
    }
  }

  let rules: SerializedRule[] = []
  try {
    const rulesData = await prisma.automationRule.findMany({
      where: {
        practiceId: user.practiceId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            runs: true,
          },
        },
      },
    })
    
    // Serialize dates to strings for client component
    rules = rulesData.map((rule) => ({
      id: rule.id,
      practiceId: rule.practiceId,
      name: rule.name,
      enabled: rule.enabled,
      triggerEvent: rule.triggerEvent,
      conditionsJson: rule.conditionsJson as any,
      actionsJson: (Array.isArray(rule.actionsJson) ? rule.actionsJson : []) as any[],
      createdByUserId: rule.createdByUserId,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      _count: rule._count,
    }))
  } catch (error: any) {
    console.error('Error fetching automation rules:', error)
    // If the error is about automationRule not existing, it means Prisma client needs restart
    if (error?.message?.includes('automationRule') || error?.message?.includes('Cannot read')) {
      console.error('⚠️  Prisma client does not have automationRule model.')
      console.error('⚠️  Please RESTART your dev server (stop with Ctrl+C, then run: npm run dev)')
    }
    // Return empty array - page will still render but show no rules
    rules = []
  }

  return <AutomationsPage initialRules={rules} practiceId={user.practiceId} userId={user.id} />
}

