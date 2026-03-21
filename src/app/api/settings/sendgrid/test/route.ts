import { NextRequest, NextResponse } from 'next/server'
import { resendIntegrationSchema } from '@/lib/validations'
import { ResendApiClient } from '@/lib/sendgrid'

export const dynamic = 'force-dynamic'

/**
 * Test Resend connection
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = resendIntegrationSchema.parse(body)

    const client = new ResendApiClient(
      validated.apiKey,
      validated.fromEmail,
      validated.fromName || undefined
    )

    const isValid = await client.testConnection()

    if (!isValid) {
      return NextResponse.json(
        { error: 'Connection failed. Please check your API key and try again.' },
        { status: 400 }
      )
    }

    const profile = await client.getAccountSummary()

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
      profile: profile || undefined,
    })
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
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 500 }
    )
  }
}

