import { unstable_noStore as noStore } from 'next/cache'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { RetellChatWidget } from './RetellChatWidget'

/** Fallback when env + RetellIntegration.portalChatAgentId are unset (voice agentId is not used for portal chat). */
const DEFAULT_PORTAL_RETELL_AGENT_ID = 'agent_7624a19359e021e2159ae5aa12'

export async function RetellChatWidgetWrapper() {
  noStore()
  const session = await getPatientSession()

  if (!session) {
    return null
  }

  const { patientId, practiceId } = session

  let retellIntegration: {
    portalChatAgentId: string | null
    portalChatPublicKey: string | null
    portalChatRecaptchaSiteKey: string | null
  } | null = null

  try {
    const [integration, patient, practice] = await Promise.all([
      prisma.retellIntegration.findUnique({
        where: { practiceId },
        select: {
          portalChatAgentId: true,
          portalChatPublicKey: true,
          portalChatRecaptchaSiteKey: true,
        },
      }),
      prisma.patient.findUnique({
        where: { id: patientId, practiceId },
        select: { firstName: true, preferredName: true, name: true },
      }),
      prisma.practice.findUnique({
        where: { id: practiceId },
        select: { name: true },
      }),
    ])
    retellIntegration = integration

    const publicKey =
      retellIntegration?.portalChatPublicKey?.trim() ||
      process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY?.trim() ||
      null

    const recaptchaSiteKey =
      retellIntegration?.portalChatRecaptchaSiteKey?.trim() ||
      process.env.NEXT_PUBLIC_RETELL_RECAPTCHA_SITE_KEY?.trim() ||
      undefined

    const agentId =
      retellIntegration?.portalChatAgentId?.trim() ||
      process.env.NEXT_PUBLIC_RETELL_AGENT_ID ||
      DEFAULT_PORTAL_RETELL_AGENT_ID

    const agentVersion = process.env.NEXT_PUBLIC_RETELL_CHAT_AGENT_VERSION?.trim() || undefined

    const firstName =
      patient?.firstName?.trim() ||
      patient?.preferredName?.trim() ||
      patient?.name?.trim()?.split(/\s+/)[0] ||
      'Patient'
    const practiceName = practice?.name?.trim() || ''
    const dynamicJson = JSON.stringify({
      source: 'patient_portal',
      patient_first_name: firstName,
      practice_name: practiceName,
    })

    if (!publicKey) {
      console.warn(
        '[Retell portal] No public key: Settings → Retell → Patient portal chat public key, or NEXT_PUBLIC_RETELL_PUBLIC_KEY.'
      )
      return null
    }

    return (
      <RetellChatWidget
        key={`${publicKey}:${agentId}:${recaptchaSiteKey ?? ''}:${dynamicJson}`}
        publicKey={publicKey}
        agentId={agentId}
        agentVersion={agentVersion}
        recaptchaSiteKey={recaptchaSiteKey}
        dynamicJson={dynamicJson}
        title="Chat with us"
        color="#0056b3"
        botName="Assistant"
        autoOpen={false}
      />
    )
  } catch (error) {
    console.error('Failed to load Retell portal widget context:', error)
    return null
  }
}
