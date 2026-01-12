import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { RetellChatWidget } from './RetellChatWidget'

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
  const retellIntegration = await prisma.retellIntegration.findUnique({
    where: {
      practiceId: session.practiceId,
    },
  })

  // Get public key from environment variable or integration
  // For now, we'll use an environment variable
  // TODO: Add publicKey field to RetellIntegration schema
  const publicKey = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY

  // Use the provided agent ID (from user) as default, can be overridden by env var or integration
  const agentId = process.env.NEXT_PUBLIC_RETELL_AGENT_ID || retellIntegration?.agentId || 'agent_9c98e3b0c1f058ba99fb135c39'

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
