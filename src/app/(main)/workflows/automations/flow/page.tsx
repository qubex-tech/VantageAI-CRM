import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { FlowBuilderPage } from '@/components/automations/FlowBuilderPage'

export const dynamic = 'force-dynamic'

interface AutomationFlowPageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function AutomationFlowPage({ searchParams }: AutomationFlowPageProps) {
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

  const params = await searchParams
  const ruleId = params.id

  // If editing, load the specific rule
  if (ruleId) {
    const rule = await prisma.automationRule.findFirst({
      where: {
        id: ruleId,
        practiceId: user.practiceId,
      },
    })

    if (!rule) {
      redirect('/workflows/automations?error=Rule not found')
    }

    const ruleToEdit = {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      triggerEvent: rule.triggerEvent,
      conditionsJson: rule.conditionsJson as any,
      actionsJson: (Array.isArray(rule.actionsJson) ? rule.actionsJson : []) as any[],
    }

    return <FlowBuilderPage practiceId={user.practiceId} userId={user.id} initialRule={ruleToEdit} />
  }

  // Otherwise, get all rules for reference
  const rulesData = await prisma.automationRule.findMany({
    where: {
      practiceId: user.practiceId,
    },
    orderBy: { createdAt: 'desc' },
  })

  const rules = rulesData.map((rule) => ({
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    triggerEvent: rule.triggerEvent,
    conditionsJson: rule.conditionsJson as any,
    actionsJson: (Array.isArray(rule.actionsJson) ? rule.actionsJson : []) as any[],
  }))

  return <FlowBuilderPage practiceId={user.practiceId} userId={user.id} initialRules={rules} />
}

