import { getTwilioClient } from '@/lib/twilio'
import { getTelnyxClient } from '@/lib/telnyx'
import { getTelnyxPracticeMismatchHint } from '@/lib/sms-practice-hints'

export type SmsProvider = 'telnyx' | 'twilio'

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

export async function getSmsClient(practiceId: string): Promise<SmsClient> {
  const { prisma } = await import('@/lib/db')

  const [twilioIntegration, telnyxIntegration] = await Promise.all([
    prisma.twilioIntegration.findFirst({
      where: { practiceId, isActive: true },
    }),
    prisma.telnyxIntegration.findFirst({
      where: { practiceId, isActive: true },
    }),
  ])

  if (
    twilioIntegration?.preferForSmsOutbound &&
    twilioIntegration.fromNumber &&
    twilioIntegration.accountSid &&
    twilioIntegration.authToken
  ) {
    const twilioClient = await getTwilioClient(practiceId)
    return {
      provider: 'twilio',
      sendSms: async (params) => {
        const result = await twilioClient.sendSms(params)
        return { ...result, provider: 'twilio' as const }
      },
    }
  }

  if (telnyxIntegration?.apiKey && telnyxIntegration.fromNumber) {
    const telnyxClient = await getTelnyxClient(practiceId)
    return {
      provider: 'telnyx',
      sendSms: async (params) => {
        const result = await telnyxClient.sendSms(params)
        return { ...result, provider: 'telnyx' as const }
      },
    }
  }

  try {
    const twilioClient = await getTwilioClient(practiceId)
    return {
      provider: 'twilio',
      sendSms: async (params) => {
        const result = await twilioClient.sendSms(params)
        return { ...result, provider: 'twilio' as const }
      },
    }
  } catch (twilioError) {
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

    throw twilioError
  }
}

export async function getActiveSmsProvider(practiceId: string): Promise<SmsProvider | null> {
  const { prisma } = await import('@/lib/db')

  const [twilioIntegration, telnyxIntegration] = await Promise.all([
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
  ])

  if (
    twilioIntegration?.preferForSmsOutbound &&
    twilioIntegration.fromNumber &&
    twilioIntegration.accountSid &&
    twilioIntegration.authToken
  ) {
    return 'twilio'
  }

  if (telnyxIntegration?.apiKey && telnyxIntegration.fromNumber) {
    return 'telnyx'
  }

  if (
    twilioIntegration?.accountSid &&
    twilioIntegration.authToken &&
    (twilioIntegration.messagingServiceSid || twilioIntegration.fromNumber)
  ) {
    return 'twilio'
  }

  return null
}
