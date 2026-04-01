import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, rateLimit } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().optional(),
})

// POST /api/mobile/push-tokens — register a device token for the authenticated user
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!rateLimit(`${user.id}:push-tokens:register`, 10, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
    }

    const { token, platform, appVersion } = parsed.data

    const record = await prisma.devicePushToken.upsert({
      where: { userId_token: { userId: user.id, token } },
      update: { platform, appVersion, updatedAt: new Date() },
      create: { userId: user.id, token, platform, appVersion },
    })

    return NextResponse.json({ id: record.id, token: record.token, platform: record.platform }, { status: 201 })
  } catch (err) {
    console.error('[mobile/push-tokens POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/mobile/push-tokens — unregister a device token (on logout)
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    const body = await req.json()
    const parsed = z.object({ token: z.string().min(1) }).safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    await prisma.devicePushToken.deleteMany({
      where: { userId: user.id, token: parsed.data.token },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[mobile/push-tokens DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
