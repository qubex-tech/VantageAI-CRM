import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import {
  redactBrowserCredential,
  upsertBrowserCredential,
} from '@/lib/browser-agent/credentials'

const upsertSchema = z.object({
  site: z.string().min(1).max(64),
  username: z.string().min(1).max(256),
  password: z.string().optional().or(z.literal('')),
  totpSecret: z.string().optional().or(z.literal('')),
  clearTotpSecret: z.boolean().optional(),
  isActive: z.boolean().optional(),
  practiceId: z.string().optional(),
})

function resolvePracticeId(
  user: { id: string; email: string; practiceId: string | null; role: string; name?: string | null },
  queryPracticeId: string | null,
  bodyPracticeId?: string
): string | null {
  let practiceId: string | null = user.practiceId
  const isAdmin = isVantageAdmin({
    id: user.id,
    email: user.email,
    role: user.role,
    practiceId: user.practiceId,
    name: user.name ?? null,
  })
  if (bodyPracticeId && isAdmin) practiceId = bodyPracticeId
  else if (queryPracticeId && isAdmin) practiceId = queryPracticeId
  return practiceId
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
    const site = req.nextUrl.searchParams.get('site') || undefined
    const practiceId = resolvePracticeId(user, queryPracticeId)

    if (!practiceId) {
      return NextResponse.json({ credentials: [] })
    }

    const credentials = await prisma.browserCredential.findMany({
      where: {
        practiceId,
        ...(site ? { site } : {}),
      },
      orderBy: { site: 'asc' },
    })

    return NextResponse.json({
      credentials: credentials.map((c) => redactBrowserCredential(c)),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch browser credentials' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
    const parsed = upsertSchema.parse(body)
    const practiceId = resolvePracticeId(user, queryPracticeId, parsed.practiceId)

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const row = await upsertBrowserCredential({
      practiceId,
      site: parsed.site.trim().toLowerCase(),
      username: parsed.username,
      password: parsed.password || undefined,
      totpSecret: parsed.totpSecret,
      clearTotpSecret: parsed.clearTotpSecret,
      isActive: parsed.isActive,
    })

    return NextResponse.json({ credential: redactBrowserCredential(row) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save browser credentials' },
      { status: 500 }
    )
  }
}
