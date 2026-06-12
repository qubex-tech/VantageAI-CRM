import { redirect } from 'next/navigation'
import { requirePracticeUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { FlowBuilderPage } from '@/components/automations/FlowBuilderPage'

export const dynamic = 'force-dynamic'

export default async function AutomationFlowPage() {
    const user = await requirePracticeUser()


  // Get existing rules to convert to flow format
  const rulesData = await prisma.automationRule.findMany({
    where: {
      practiceId: user.practiceId,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Serialize and type-cast the rules to match FlowBuilderPage expectations
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

