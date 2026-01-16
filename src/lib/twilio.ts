/**
 * Twilio API Client
 *
 * Handles SMS sending via Twilio REST API
 * Documentation: https://www.twilio.com/docs/sms/api/message-resource
 */

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
}

function formatE164(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) {
    return trimmed
  }
  const digits = trimmed.replace(/[^\d]/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return trimmed
}

function buildBasicAuthHeader(accountSid: string, authToken: string): string {
  const token = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  return `Basic ${token}`
}

export class TwilioApiClient {
  private accountSid: string
  private authToken: string
  private baseUrl: string
  private messagingServiceSid?: string
  private defaultFromNumber?: string

  constructor(
    accountSid: string,
    authToken: string,
    messagingServiceSid?: string,
    defaultFromNumber?: string,
    baseUrl: string = 'https://api.twilio.com/2010-04-01'
  ) {
    this.accountSid = accountSid
    this.authToken = authToken
    this.messagingServiceSid = messagingServiceSid || undefined
    this.defaultFromNumber = defaultFromNumber || undefined
    this.baseUrl = baseUrl
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/Accounts/${this.accountSid}.json`, {
        method: 'GET',
        headers: {
          Authorization: buildBasicAuthHeader(this.accountSid, this.authToken),
        },
      })
      return response.ok
    } catch (error) {
      console.error('Twilio connection test failed:', error)
      return false
    }
  }

  async testMessagingService(): Promise<boolean> {
    if (!this.messagingServiceSid) {
      return true
    }
    try {
      const response = await fetch(
        `${this.baseUrl}/Accounts/${this.accountSid}/Messaging/Services/${this.messagingServiceSid}.json`,
        {
          method: 'GET',
          headers: {
            Authorization: buildBasicAuthHeader(this.accountSid, this.authToken),
          },
        }
      )
      return response.ok
    } catch (error) {
      console.error('Twilio messaging service test failed:', error)
      return false
    }
  }

  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    try {
      const messagingServiceSid = params.messagingServiceSid || this.messagingServiceSid
      const from = params.from || this.defaultFromNumber

      if (!messagingServiceSid && !from) {
        return {
          success: false,
          error: 'Twilio requires a Messaging Service SID or a From Number.',
        }
      }

      const form = new URLSearchParams()
      form.set('To', formatE164(params.to))
      form.set('Body', params.body)
      if (params.statusCallback) {
        form.set('StatusCallback', params.statusCallback)
      }

      if (messagingServiceSid) {
        form.set('MessagingServiceSid', messagingServiceSid)
      } else if (from) {
        form.set('From', formatE164(from))
      }

      const response = await fetch(
        `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: buildBasicAuthHeader(this.accountSid, this.authToken),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        let errorMessage = 'Failed to send SMS via Twilio'
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch {
          if (response.status === 401 || response.status === 403) {
            errorMessage = 'Invalid Twilio credentials or insufficient permissions.'
          } else if (response.status === 429) {
            errorMessage = 'Twilio rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = 'Twilio service is temporarily unavailable. Please try again later.'
          }
        }

        return {
          success: false,
          error: errorMessage,
        }
      }

      const data = await response.json()
      return {
        success: true,
        messageId: data.sid,
      }
    } catch (error: any) {
      console.error('Twilio SMS send failed:', error)
      return {
        success: false,
        error: error?.message || 'Failed to send SMS via Twilio',
      }
    }
  }
}

export async function getTwilioClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  const integration = await prisma.twilioIntegration.findFirst({
    where: {
      practiceId,
      isActive: true,
    },
  })

  if (!integration || !integration.accountSid || !integration.authToken) {
    throw new Error('Twilio integration not configured or not active. Please configure it in Settings → Twilio Integration.')
  }

  if (!integration.messagingServiceSid && !integration.fromNumber) {
    throw new Error('Twilio integration requires a Messaging Service SID or a From Number.')
  }

  return new TwilioApiClient(
    integration.accountSid,
    integration.authToken,
    integration.messagingServiceSid || undefined,
    integration.fromNumber || undefined
  )
}
