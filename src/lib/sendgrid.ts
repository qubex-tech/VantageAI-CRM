/**
 * SendGrid API Client
 * 
 * Handles email sending via SendGrid API
 * Documentation: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */

export interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  htmlContent?: string
  textContent?: string
  fromEmail?: string
  fromName?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * SendGrid API Client class
 */
export class SendgridApiClient {
  private apiKey: string
  private baseUrl: string
  private defaultFromEmail: string
  private defaultFromName?: string

  constructor(
    apiKey: string,
    defaultFromEmail: string,
    defaultFromName?: string,
    baseUrl: string = 'https://api.sendgrid.com/v3'
  ) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.defaultFromEmail = defaultFromEmail
    this.defaultFromName = defaultFromName
  }

  /**
   * Test the API key by making a simple API call
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch (error) {
      console.error('SendGrid connection test failed:', error)
      return false
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<{ email: string; username: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return {
        email: data.email || '',
        username: data.username || '',
      }
    } catch (error) {
      console.error('Failed to fetch SendGrid user profile:', error)
      return null
    }
  }

  /**
   * Send an email via SendGrid
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const fromEmail = params.fromEmail || this.defaultFromEmail
      const fromName = params.fromName || this.defaultFromName

      // Build the email payload according to SendGrid API v3
      const payload = {
        personalizations: [
          {
            to: [
              {
                email: params.to,
                name: params.toName || undefined,
              },
            ],
            subject: params.subject,
          },
        ],
        from: {
          email: fromEmail,
          name: fromName || undefined,
        },
        content: [
          ...(params.htmlContent
            ? [
                {
                  type: 'text/html',
                  value: params.htmlContent,
                },
              ]
            : []),
          ...(params.textContent
            ? [
                {
                  type: 'text/plain',
                  value: params.textContent,
                },
              ]
            : [
                // If no content provided, use HTML content as plain text fallback
                {
                  type: 'text/plain',
                  value: params.htmlContent?.replace(/<[^>]*>/g, '') || '',
                },
              ]),
        ],
      }

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        let errorMessage = `SendGrid API error: ${response.status} ${response.statusText}`
        
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
            errorMessage = errorJson.errors.map((e: any) => e.message || e.field || '').join(', ')
          }
        } catch {
          // If parsing fails, use the raw error body
          if (errorBody) {
            errorMessage = errorBody
          }
        }

        return {
          success: false,
          error: errorMessage,
        }
      }

      // SendGrid returns 202 Accepted on success, with message-id in headers
      const messageId = response.headers.get('x-message-id') || undefined

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      console.error('Failed to send email via SendGrid:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error sending email',
      }
    }
  }
}

/**
 * Get SendGrid client for a practice
 */
export async function getSendgridClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  const integration = await prisma.sendgridIntegration.findUnique({
    where: {
      practiceId,
      isActive: true,
    },
  })

  if (!integration) {
    throw new Error('SendGrid integration not found or not active')
  }

  return new SendgridApiClient(
    integration.apiKey,
    integration.fromEmail,
    integration.fromName || undefined
  )
}

