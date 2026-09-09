import { getTwilioClient } from '@/lib/twilio'
import { getTelnyxClient } from '@/lib/telnyx'
import { getApidazeClient, isApidazePlatformConfigured } from '@/lib/apidaze'
import { getTelnyxPracticeMismatchHint } from '@/lib/sms-practice-hints'

export type SmsProvider = 'apidaze' | 'telnyx' | 'twilio'

export interface SendSmsParams {
  to: string
  body: string
  from?: string
  messagingServiceSid?: string
  statusCallback?: string
}

export interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
  provider: SmsProvider
}

export interface SmsClient {
  provider: SmsProvider
  sendSms(params: SendSmsParams): Promise<SendSmsResult>
}

export interface SmsProviderSelectionInput {
  apidazePlatformConfigured: boolean
  apidazeActive: boolean
  apidazeFromNumber?: string | null
  twilioPreferForSmsOutbound: boolean
  twilioFromNumber?: string | null
  twilioAccountSid?: string | null
  twilioAuthToken?: string | null
  twilioMessagingServiceSid?: string | null
  telnyxApiKey?: string | null
  telnyxFromNumber?: string | null
}

export function selectSmsProvider(input: SmsProviderSelectionInput): SmsProvider | null {
  if (input.apidazePlatformConfigured && input.apidazeActive && input.apidazeFromNumber) {
    return 'apidaze'
  }

  if (
    input.twilioPreferForSmsOutbound &&
    input.twilioFromNumber &&
    input.twilioAccountSid &&
    input.twilioAuthToken
  ) {
    return 'twilio'
  }

  if (input.telnyxApiKey && input.telnyxFromNumber) {
    return 'telnyx'
  }

  if (
    input.twilioAccountSid &&
    input.twilioAuthToken &&
    (input.twilioMessagingServiceSid || input.twilioFromNumber)
  ) {
    return 'twilio'
  }

  return null
}

export async function getSmsClient(practiceId: string): Promise<SmsClient> {
  const { prisma } = await import('@/lib/db')

  const [twilioIntegration, telnyxIntegration, apidazeIntegration] = await Promise.all([
    prisma.twilioIntegration.findFirst({
      where: { practiceId, isActive: true },
    }),
    prisma.telnyxIntegration.findFirst({
      where: { practiceId, isActive: true },
    }),
    prisma.apidazeIntegration
      .findFirst({
        where: { practiceId, isActive: true },
      })
      .catch(() => null),
  ])

  const provider = selectSmsProvider({
    apidazePlatformConfigured: isApidazePlatformConfigured(),
    apidazeActive: Boolean(apidazeIntegration?.isActive),
    apidazeFromNumber: apidazeIntegration?.fromNumber,
    twilioPreferForSmsOutbound: Boolean(twilioIntegration?.preferForSmsOutbound),
    twilioFromNumber: twilioIntegration?.fromNumber,
    twilioAccountSid: twilioIntegration?.accountSid,
    twilioAuthToken: twilioIntegration?.authToken,
    twilioMessagingServiceSid: twilioIntegration?.messagingServiceSid,
    telnyxApiKey: telnyxIntegration?.apiKey,
    telnyxFromNumber: telnyxIntegration?.fromNumber,
  })

  if (provider === 'apidaze') {
    const apidazeClient = await getApidazeClient(practiceId)
    return {
      provider: 'apidaze',
      sendSms: async (params) => {
        const result = await apidazeClient.sendSms(params)
        return { ...result, provider: 'apidaze' as const }
      },
    }
  }

  if (provider === 'telnyx') {
    const telnyxClient = await getTelnyxClient(practiceId)
    return {
      provider: 'telnyx',
      sendSms: async (params) => {
        const result = await telnyxClient.sendSms(params)
        return { ...result, provider: 'telnyx' as const }
      },
    }
  }

  if (provider === 'twilio') {
    const twilioClient = await getTwilioClient(practiceId)
    return {
      provider: 'twilio',
      sendSms: async (params) => {
        const result = await twilioClient.sendSms(params)
        return { ...result, provider: 'twilio' as const }
      },
    }
  }

  const mismatchHint = await getTelnyxPracticeMismatchHint(practiceId)
  if (mismatchHint) {
    throw new Error(mismatchHint)
  }

  const configuredElsewhere = await prisma.telnyxIntegration.findFirst({
    where: { isActive: true },
    include: { practice: { select: { name: true } } },
  })

  if (configuredElsewhere && configuredElsewhere.practiceId !== practiceId) {
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { name: true },
    })
    throw new Error(
      `Telnyx is configured for "${configuredElsewhere.practice.name}" but not for "${practice?.name || 'this practice'}". In Settings → Practice Configuration, select "${practice?.name || 'this practice'}" and save the same Telnyx API key and phone number.`
    )
  }

  throw new Error(
    'No SMS provider is configured for this practice. Set an Apidaze from-number or configure Telnyx/Twilio in Settings.'
  )
}

export async function getActiveSmsProvider(practiceId: string): Promise<SmsProvider | null> {
  const { prisma } = await import('@/lib/db')

  const [twilioIntegration, telnyxIntegration, apidazeIntegration] = await Promise.all([
    prisma.twilioIntegration.findFirst({
      where: { practiceId, isActive: true },
      select: {
        accountSid: true,
        authToken: true,
        messagingServiceSid: true,
        fromNumber: true,
        preferForSmsOutbound: true,
      },
    }),
    prisma.telnyxIntegration.findFirst({
      where: { practiceId, isActive: true },
      select: { apiKey: true, fromNumber: true },
    }),
    prisma.apidazeIntegration
      .findFirst({
        where: { practiceId, isActive: true },
        select: { fromNumber: true, isActive: true },
      })
      .catch(() => null),
  ])

  return selectSmsProvider({
    apidazePlatformConfigured: isApidazePlatformConfigured(),
    apidazeActive: Boolean(apidazeIntegration?.isActive),
    apidazeFromNumber: apidazeIntegration?.fromNumber,
    twilioPreferForSmsOutbound: Boolean(twilioIntegration?.preferForSmsOutbound),
    twilioFromNumber: twilioIntegration?.fromNumber,
    twilioAccountSid: twilioIntegration?.accountSid,
    twilioAuthToken: twilioIntegration?.authToken,
    twilioMessagingServiceSid: twilioIntegration?.messagingServiceSid,
    telnyxApiKey: telnyxIntegration?.apiKey,
    telnyxFromNumber: telnyxIntegration?.fromNumber,
  })
}
