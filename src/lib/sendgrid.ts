/**
 * Resend API Client
 *
 * Note: this file name is kept for backward-compatible imports.
 * Runtime delivery now uses Resend.
 */

export interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  htmlContent?: string
  textContent?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class ResendApiClient {
  private apiKey: string
  private baseUrl: string
  private defaultFromEmail: string
  private defaultFromName?: string

  constructor(
    apiKey: string,
    defaultFromEmail: string,
    defaultFromName?: string,
    baseUrl: string = 'https://api.resend.com'
  ) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.defaultFromEmail = defaultFromEmail
    this.defaultFromName = defaultFromName
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      console.error('Resend connection test failed:', error)
      return false
    }
  }

  async getAccountSummary(): Promise<{ provider: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      return { provider: 'resend' }
    } catch (error) {
      console.error('Failed to fetch Resend account summary:', error)
      return null
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const fromEmail = params.fromEmail || this.defaultFromEmail
      const fromName = params.fromName || this.defaultFromName

      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
      const textBody = params.textContent || (params.htmlContent ? params.htmlContent.replace(/<[^>]*>/g, '') : undefined)
      const payload: Record<string, unknown> = {
        from,
        to: [params.to],
        subject: params.subject,
        html: params.htmlContent || undefined,
        text: textBody,
      }
      if (params.replyTo) {
        payload.reply_to = params.replyTo
      }

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to send email via Resend'
        const errorBody = await response.text()
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson?.message) {
            const raw = String(errorJson.message)
            if (response.status === 401 || response.status === 403) {
              errorMessage = 'Invalid Resend API key or insufficient permissions.'
            } else if (response.status === 429 || raw.toLowerCase().includes('rate')) {
              errorMessage = 'Resend rate limit exceeded. Please try again later.'
            } else if (raw.toLowerCase().includes('from') || raw.toLowerCase().includes('domain')) {
              errorMessage = 'Sender email/domain is not verified in Resend.'
            } else {
              errorMessage = raw
            }
          }
        } catch {
          if (response.status === 401 || response.status === 403) {
            errorMessage = 'Invalid Resend API key or insufficient permissions.'
          } else if (response.status === 429) {
            errorMessage = 'Resend rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = 'Resend service is temporarily unavailable. Please try again later.'
          } else if (errorBody) {
            errorMessage = errorBody.length > 200 ? 'Failed to send email via Resend' : errorBody
          }
        }

        return {
          success: false,
          error: errorMessage,
        }
      }

      const data = await response.json().catch(() => ({}))
      const messageId = typeof data?.id === 'string' ? data.id : undefined

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      console.error('Failed to send email via Resend:', error)
      let errorMessage = 'Unknown error sending email'
      
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Unable to connect to Resend. Please check your internet connection and try again.'
        } else {
          errorMessage = error.message
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}

export async function getSendgridClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  const integration = await prisma.sendgridIntegration.findFirst({
    where: {
      practiceId,
      isActive: true,
    },
  })

  if (!integration || !integration.apiKey || !integration.fromEmail) {
    throw new Error('Resend integration not configured or not active. Please configure it in Settings -> Resend Integration.')
  }

  return new ResendApiClient(
    integration.apiKey,
    integration.fromEmail,
    integration.fromName || undefined
  )
}

// Backward-compatible export name for existing imports.
export const SendgridApiClient = ResendApiClient

