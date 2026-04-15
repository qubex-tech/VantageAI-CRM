import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import { outboundCustomerNotificationsSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

function normalizeUser(user: Awaited<ReturnType<typeof requireAuth>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    practiceId: user.practiceId,
    role: user.role,
  }
}

/**
 * Vantage Admin only: per-practice outbound customer notification preferences.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!isVantageAdmin(normalizeUser(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const practiceId = req.nextUrl.searchParams.get('practiceId')
    if (!practiceId) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 })
    }

    const row = await prisma.practiceSettings.findUnique({
      where: { practiceId },
      select: { outboundCustomerNotifications: true },
    })

    const parsed = outboundCustomerNotificationsSchema.safeParse(row?.outboundCustomerNotifications ?? {})
    const settings = parsed.success
      ? parsed.data
      : { recipientEmail: null as string | null, notifyUnsuccessfulTransfer: false }

    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!isVantageAdmin(normalizeUser(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const practiceId = req.nextUrl.searchParams.get('practiceId')
    if (!practiceId) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const validated = outboundCustomerNotificationsSchema.parse(body)

    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { id: true },
    })
    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 })
    }

    const outboundCustomerNotifications = {
      recipientEmail: validated.recipientEmail ?? null,
      notifyUnsuccessfulTransfer: validated.notifyUnsuccessfulTransfer ?? false,
    }

    await prisma.practiceSettings.upsert({
      where: { practiceId },
      create: {
        practiceId,
        outboundCustomerNotifications,
      },
      update: {
        outboundCustomerNotifications,
      },
    })

    return NextResponse.json({ settings: outboundCustomerNotifications })
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    )
  }
}
