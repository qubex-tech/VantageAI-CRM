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

      // SendGrid requires: text/plain must be first, then text/html
      const content: Array<{ type: string; value: string }> = []
      
      // Add text/plain first (required to be first if present)
      if (params.textContent) {
        content.push({
          type: 'text/plain',
          value: params.textContent,
        })
      } else if (params.htmlContent) {
        // If no textContent but we have htmlContent, create plain text from HTML
        content.push({
          type: 'text/plain',
          value: params.htmlContent.replace(/<[^>]*>/g, '') || '',
        })
      }
      
      // Add text/html second (if present)
      if (params.htmlContent) {
        content.push({
          type: 'text/html',
          value: params.htmlContent,
        })
      }

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
        content: content,
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
        let errorMessage = 'Failed to send email via SendGrid'
        
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
            const errors = errorJson.errors.map((e: any) => {
              // Provide user-friendly error messages
              if (e.message) {
                // Handle common SendGrid errors
                if (e.message.includes('Invalid API key') || e.message.includes('401')) {
                  return 'Invalid SendGrid API key. Please check your API key in Settings.'
                }
                if (e.message.includes('Forbidden') || e.message.includes('403')) {
                  return 'SendGrid API key does not have permission to send emails.'
                }
                if (e.message.includes('rate limit') || e.message.includes('429')) {
                  return 'SendGrid rate limit exceeded. Please try again later.'
                }
                if (e.message.includes('from email') || e.message.includes('sender')) {
                  return 'Invalid sender email address. Please check your "From Email" in Settings.'
                }
                return e.message
              }
              return e.field ? `${e.field}: Invalid value` : 'Unknown error'
            })
            errorMessage = errors.join(', ')
          }
        } catch {
          // If parsing fails, provide a generic message based on status code
          if (response.status === 401 || response.status === 403) {
            errorMessage = 'Invalid SendGrid API key or insufficient permissions. Please check your API key in Settings.'
          } else if (response.status === 429) {
            errorMessage = 'SendGrid rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = 'SendGrid service is temporarily unavailable. Please try again later.'
          } else if (errorBody) {
            errorMessage = errorBody.length > 200 ? 'Failed to send email via SendGrid' : errorBody
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
      let errorMessage = 'Unknown error sending email'
      
      if (error instanceof Error) {
        // Handle network errors
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Unable to connect to SendGrid. Please check your internet connection and try again.'
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

/**
 * Get SendGrid client for a practice
 */
export async function getSendgridClient(practiceId: string) {
  const { prisma } = await import('@/lib/db')

  const integration = await prisma.sendgridIntegration.findFirst({
    where: {
      practiceId,
      isActive: true,
    },
  })

  if (!integration || !integration.apiKey || !integration.fromEmail) {
    throw new Error('SendGrid integration not configured or not active. Please configure it in Settings → SendGrid Integration.')
  }

  return new SendgridApiClient(
    integration.apiKey,
    integration.fromEmail,
    integration.fromName || undefined
  )
}

