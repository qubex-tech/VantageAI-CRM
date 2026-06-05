import { getTwilioClient } from '@/lib/twilio'
import { getTelnyxClient } from '@/lib/telnyx'

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

  const telnyxIntegration = await prisma.telnyxIntegration.findFirst({
    where: {
      practiceId,
      isActive: true,
    },
  })

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

  const twilioClient = await getTwilioClient(practiceId)
  return {
    provider: 'twilio',
    sendSms: async (params) => {
      const result = await twilioClient.sendSms(params)
      return { ...result, provider: 'twilio' as const }
    },
  }
}

export async function getActiveSmsProvider(practiceId: string): Promise<SmsProvider | null> {
  const { prisma } = await import('@/lib/db')

  const telnyxIntegration = await prisma.telnyxIntegration.findFirst({
    where: { practiceId, isActive: true },
    select: { apiKey: true, fromNumber: true },
  })
  if (telnyxIntegration?.apiKey && telnyxIntegration.fromNumber) {
    return 'telnyx'
  }

  const twilioIntegration = await prisma.twilioIntegration.findFirst({
    where: { practiceId, isActive: true },
    select: { accountSid: true, authToken: true, messagingServiceSid: true, fromNumber: true },
  })
  if (
    twilioIntegration?.accountSid &&
    twilioIntegration.authToken &&
    (twilioIntegration.messagingServiceSid || twilioIntegration.fromNumber)
  ) {
    return 'twilio'
  }

  return null
}
