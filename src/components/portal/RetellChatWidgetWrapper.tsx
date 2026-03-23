import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { RetellChatWidget } from './RetellChatWidget'

/** Fallback when env + RetellIntegration.portalChatAgentId are unset (voice agentId is not used for portal chat). */
const DEFAULT_PORTAL_RETELL_AGENT_ID = 'agent_7624a19359e021e2159ae5aa12'

/**
 * Server component wrapper for Retell Chat Widget
 * Fetches practice-specific configuration and renders the widget
 */
export async function RetellChatWidgetWrapper() {
  const session = await getPatientSession()
  
  // If no session, don't render widget
  if (!session) {
    return null
  }

  // Get practice's Retell integration
  let retellIntegration: { portalChatAgentId: string | null } | null = null
  try {
    retellIntegration = await prisma.retellIntegration.findUnique({
      where: {
        practiceId: session.practiceId,
      },
      select: {
        portalChatAgentId: true,
      },
    })
  } catch (error) {
    console.error('Failed to load Retell integration for portal widget:', error)
  }

  // Get public key from environment variable or integration
  // For now, we'll use an environment variable
  // TODO: Add publicKey field to RetellIntegration schema
  const publicKey = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY

  // Portal chat only: env → RetellIntegration.portalChatAgentId → code default (not voice agentId)
  const agentId =
    process.env.NEXT_PUBLIC_RETELL_AGENT_ID ||
    retellIntegration?.portalChatAgentId ||
    DEFAULT_PORTAL_RETELL_AGENT_ID

  // Only render if we have a public key
  if (!publicKey) {
    console.warn('Retell public key not configured. Chat widget will not be displayed.')
    return null
  }

  return (
    <RetellChatWidget
      publicKey={publicKey}
      agentId={agentId}
      title="Chat with us"
      color="#0056b3"
      botName="Assistant"
      autoOpen={false}
    />
  )
}
