import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { getActiveSmsProvider } from '@/lib/sms'
import { smsFromNumberSchema } from '@/lib/validations'
import { TelnyxApiClient } from '@/lib/telnyx'

export const dynamic = 'force-dynamic'

function resolvePracticeId(
  user: { practiceId: string | null; name?: string | null; id: string; email: string; role: string },
  queryPracticeId: string | null
): string | null {
  const normalizedUser = {
    ...user,
    name: user.name ?? null,
  }
  if (queryPracticeId && isVantageAdmin(normalizedUser)) {
    return queryPracticeId
  }
  return user.practiceId
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

async function clearTwilioPreferForSmsOutbound(practiceId: string) {
  const twilio = await prisma.twilioIntegration.findUnique({ where: { practiceId } })
  if (twilio?.preferForSmsOutbound) {
    await prisma.twilioIntegration.update({
      where: { practiceId },
      data: { preferForSmsOutbound: false },
    })
  }
}

/**
 * GET /api/settings/sms/sender
 * Returns the active SMS provider and configured outbound sender for a practice.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json({
        activeProvider: null,
        fromNumber: null,
        fromNumberSource: null,
        telnyxConfigured: false,
        twilioConfigured: false,
      })
    }

    const [telnyx, twilio, activeProvider] = await Promise.all([
      prisma.telnyxIntegration.findUnique({
        where: { practiceId },
        select: {
          fromNumber: true,
          phoneNumberId: true,
          messagingProfileId: true,
          isActive: true,
          apiKey: true,
        },
      }),
      prisma.twilioIntegration.findUnique({
        where: { practiceId },
        select: {
          fromNumber: true,
          messagingServiceSid: true,
          isActive: true,
          accountSid: true,
          authToken: true,
          preferForSmsOutbound: true,
        },
      }),
      getActiveSmsProvider(practiceId),
    ])

    const telnyxConfigured = Boolean(
      telnyx?.isActive && telnyx.apiKey && telnyx.fromNumber
    )
    const twilioConfigured = Boolean(
      twilio?.isActive &&
        twilio.accountSid &&
        twilio.authToken &&
        (twilio.messagingServiceSid || twilio.fromNumber)
    )

    const fromNumberSource =
      twilio?.preferForSmsOutbound && twilio.fromNumber
        ? 'custom'
        : telnyxConfigured
          ? 'telnyx_inventory'
          : twilio?.fromNumber
            ? 'custom'
            : null

    let fromNumber: string | null = null
    if (fromNumberSource === 'custom' && twilio?.fromNumber) {
      fromNumber = twilio.fromNumber
    } else if (activeProvider === 'telnyx' && telnyx?.fromNumber) {
      fromNumber = telnyx.fromNumber
    } else if (activeProvider === 'twilio' && twilio?.fromNumber) {
      fromNumber = twilio.fromNumber
    } else if (telnyx?.fromNumber) {
      fromNumber = telnyx.fromNumber
    } else if (twilio?.fromNumber) {
      fromNumber = twilio.fromNumber
    }

    return NextResponse.json({
      activeProvider,
      fromNumber,
      fromNumberSource,
      telnyxConfigured,
      twilioConfigured,
      telnyx: telnyx
        ? {
            fromNumber: telnyx.fromNumber,
            phoneNumberId: telnyx.phoneNumberId,
            messagingProfileId: telnyx.messagingProfileId,
            apiKeyConfigured: Boolean(telnyx.apiKey),
          }
        : null,
      twilio: twilio
        ? {
            fromNumber: twilio.fromNumber,
            messagingServiceSid: twilio.messagingServiceSid,
            configured: Boolean(twilio.accountSid && twilio.authToken),
            preferForSmsOutbound: twilio.preferForSmsOutbound,
          }
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SMS sender settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/sms/sender
 * Update the outbound SMS From Number for the active (or available) provider.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(user, req.nextUrl.searchParams.get('practiceId'))

    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = smsFromNumberSchema.parse(body)
    const fromNumber = formatE164(validated.fromNumber)

    if (validated.fromNumberSource === 'custom') {
      const twilio = await prisma.twilioIntegration.findUnique({
        where: { practiceId },
      })

      if (twilio?.accountSid && twilio.authToken) {
        const updated = await prisma.twilioIntegration.update({
          where: { practiceId },
          data: {
            fromNumber,
            preferForSmsOutbound: true,
            isActive: true,
          },
        })

        return NextResponse.json({
          success: true,
          provider: 'twilio',
          fromNumberSource: 'custom',
          fromNumber: updated.fromNumber,
        })
      }

      const telnyx = await prisma.telnyxIntegration.findUnique({
        where: { practiceId },
      })

      if (telnyx?.apiKey) {
        await clearTwilioPreferForSmsOutbound(practiceId)
        const updated = await prisma.telnyxIntegration.update({
          where: { practiceId },
          data: {
            fromNumber,
            phoneNumberId: validated.phoneNumberId || null,
            messagingProfileId: validated.messagingProfileId || telnyx.messagingProfileId || null,
            isActive: true,
          },
        })

        return NextResponse.json({
          success: true,
          provider: 'telnyx',
          fromNumberSource: 'custom',
          fromNumber: updated.fromNumber,
          warning:
            'Twilio is not configured. This number will be sent via Telnyx and must be routable on your Telnyx account.',
        })
      }

      return NextResponse.json(
        {
          error:
            'Configure Twilio credentials to use a custom non-Telnyx From Number, or configure Telnyx for manual sender entry.',
        },
        { status: 400 }
      )
    }

    await clearTwilioPreferForSmsOutbound(practiceId)

    const telnyx = await prisma.telnyxIntegration.findUnique({
      where: { practiceId },
    })

    if (telnyx?.apiKey) {
      const client = new TelnyxApiClient(
        telnyx.apiKey,
        fromNumber,
        validated.messagingProfileId || telnyx.messagingProfileId || undefined
      )
      const numbers = await client.listPhoneNumbers()
      const selected = numbers.find((entry) => entry.phoneNumber === fromNumber)
      if (!selected) {
        return NextResponse.json(
          {
            error:
              'Selected phone number was not found in your Telnyx account. Use "Custom number" if this sender is not a Telnyx number.',
          },
          { status: 400 }
        )
      }
      if (!selected.messagingReady) {
        return NextResponse.json(
          {
            error:
              'Selected phone number is not messaging-ready. Assign it to a messaging profile in Telnyx first.',
          },
          { status: 400 }
        )
      }

      const updated = await prisma.telnyxIntegration.update({
        where: { practiceId },
        data: {
          fromNumber,
          phoneNumberId: validated.phoneNumberId || selected.id || null,
          messagingProfileId:
            validated.messagingProfileId || selected.messagingProfileId || null,
          isActive: true,
        },
      })

      return NextResponse.json({
        success: true,
        provider: 'telnyx',
        fromNumberSource: 'telnyx_inventory',
        fromNumber: updated.fromNumber,
      })
    }

    const twilio = await prisma.twilioIntegration.findUnique({
      where: { practiceId },
    })

    if (twilio?.accountSid && twilio.authToken) {
      const updated = await prisma.twilioIntegration.update({
        where: { practiceId },
        data: {
          fromNumber,
          preferForSmsOutbound: false,
          isActive: true,
        },
      })

      return NextResponse.json({
        success: true,
        provider: 'twilio',
        fromNumberSource: 'custom',
        fromNumber: updated.fromNumber,
      })
    }

    return NextResponse.json(
      {
        error:
          'Configure Telnyx or Twilio credentials first in the sections below, then set the From Number here.',
      },
      { status: 400 }
    )
  } catch (error) {
    const zodMessage = formatZodError(error)
    if (zodMessage) {
      return NextResponse.json({ error: `Validation error: ${zodMessage}` }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update SMS sender' },
      { status: 500 }
    )
  }
}
