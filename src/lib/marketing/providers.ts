// Email and SMS provider interfaces and stub implementations

import { EmailProvider, SmsProvider } from './types'

/**
 * Stub email provider (logs to console)
 */
export class StubEmailProvider implements EmailProvider {
  async sendEmail(params: {
    to: string
    from: string
    fromName?: string
    replyTo?: string
    subject: string
    html: string
    text?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('[StubEmailProvider] Sending email:', {
      to: params.to,
      from: params.from,
      fromName: params.fromName,
      replyTo: params.replyTo,
      subject: params.subject,
      htmlLength: params.html.length,
      textLength: params.text?.length || 0,
    })
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Generate mock message ID
    const messageId = `stub-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      success: true,
      messageId,
    }
  }
}

/**
 * Stub SMS provider (logs to console)
 */
export class StubSmsProvider implements SmsProvider {
  async sendSms(params: {
    to: string
    from: string
    message: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('[StubSmsProvider] Sending SMS:', {
      to: params.to,
      from: params.from,
      message: params.message.substring(0, 100) + (params.message.length > 100 ? '...' : ''),
      length: params.message.length,
    })
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Generate mock message ID
    const messageId = `stub-sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      success: true,
      messageId,
    }
  }
}

// Export singleton instances
export const stubEmailProvider = new StubEmailProvider()
export const stubSmsProvider = new StubSmsProvider()
