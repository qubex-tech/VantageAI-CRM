import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { twilioIntegrationSchema } from '@/lib/validations'
import { TwilioApiClient } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = await req.json()
    const validated = twilioIntegrationSchema.parse(body)

    const client = new TwilioApiClient(
      validated.accountSid,
      validated.authToken,
      validated.messagingServiceSid || undefined,
      validated.fromNumber || undefined
    )

    const isValid = await client.testConnection()
    const serviceValid = await client.testMessagingService()

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Twilio credentials or connection failed' }, { status: 400 })
    }

    if (!serviceValid) {
      return NextResponse.json({ error: 'Invalid Twilio Messaging Service SID' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
      const errorMessage = zodError.issues.map(issue => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      }).join(', ')
      return NextResponse.json({ error: `Validation error: ${errorMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Twilio connection test failed' },
      { status: 500 }
    )
  }
}
