import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { telnyxCredentialsSchema } from '@/lib/validations'
import { TelnyxApiClient } from '@/lib/telnyx'

export const dynamic = 'force-dynamic'

function formatZodError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    const zodError = error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }
    return zodError.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      })
      .join(', ')
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = await req.json()
    const validated = telnyxCredentialsSchema.parse(body)

    const client = new TelnyxApiClient(validated.apiKey)
    const isValid = await client.testConnection()
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Telnyx API key or connection failed' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Telnyx connection test failed' },
      { status: 500 }
    )
  }
}
