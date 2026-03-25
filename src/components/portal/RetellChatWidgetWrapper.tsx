import { unstable_noStore as noStore } from 'next/cache'
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
  noStore()
  const session = await getPatientSession()

  if (!session) {
    return null
  }

  let retellIntegration: { portalChatAgentId: string | null; portalChatPublicKey: string | null } | null =
    null
  try {
    retellIntegration = await prisma.retellIntegration.findUnique({
      where: {
        practiceId: session.practiceId,
      },
      select: {
        portalChatAgentId: true,
        portalChatPublicKey: true,
      },
    })
  } catch (error) {
    console.error('Failed to load Retell integration for portal widget:', error)
  }

  // Public key: per-practice (Settings) first, then hosting env
  const publicKey =
    retellIntegration?.portalChatPublicKey?.trim() ||
    process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY?.trim() ||
    null

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RETELL_RECAPTCHA_SITE_KEY?.trim() || undefined

  const agentId =
    retellIntegration?.portalChatAgentId?.trim() ||
    process.env.NEXT_PUBLIC_RETELL_AGENT_ID ||
    DEFAULT_PORTAL_RETELL_AGENT_ID

  if (!publicKey) {
    console.warn(
      '[Retell portal] No public key: add it in Settings → Retell → Patient portal chat public key, or set NEXT_PUBLIC_RETELL_PUBLIC_KEY.'
    )
    return null
  }

  return (
    <RetellChatWidget
      key={`${publicKey}:${agentId}:${recaptchaSiteKey ?? ''}`}
      publicKey={publicKey}
      agentId={agentId}
      recaptchaSiteKey={recaptchaSiteKey}
      title="Chat with us"
      color="#0056b3"
      botName="Assistant"
      autoOpen={false}
    />
  )
}
