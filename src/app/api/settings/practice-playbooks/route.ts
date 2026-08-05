import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import {
  AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
  getOrCreatePracticePlaybook,
  getPracticePlaybook,
  updatePracticePlaybookConfig,
} from '@/lib/browser-agent/practice-playbook'

const putSchema = z.object({
  playbookKey: z.string().optional(),
  config: z.unknown().optional(),
  sourceVideoUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  name: z.string().optional(),
  practiceId: z.string().optional(),
})

function resolvePracticeId(
  user: Awaited<ReturnType<typeof requireAuth>>,
  queryPracticeId: string | null,
  bodyPracticeId?: string
): string | null {
  let practiceId: string | null = user.practiceId
  const admin = isVantageAdmin({
    id: user.id,
    email: user.email,
    role: user.role,
    practiceId: user.practiceId,
    name: user.name ?? null,
  })
  if (bodyPracticeId && admin) practiceId = bodyPracticeId
  else if (queryPracticeId && admin) practiceId = queryPracticeId
  return practiceId
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
    const playbookKey =
      req.nextUrl.searchParams.get('playbookKey') || AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
    const createIfMissing = req.nextUrl.searchParams.get('create') === '1'

    const practiceId = resolvePracticeId(user, queryPracticeId)
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const playbook = createIfMissing
      ? await getOrCreatePracticePlaybook(practiceId, playbookKey)
      : await getPracticePlaybook(practiceId, playbookKey)

    return NextResponse.json({ playbook })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch practice playbook',
      },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const parsed = putSchema.parse(body)
    const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
    const practiceId = resolvePracticeId(user, queryPracticeId, parsed.practiceId)

    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const playbook = await updatePracticePlaybookConfig({
      practiceId,
      playbookKey: parsed.playbookKey || AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
      config: parsed.config,
      sourceVideoUrl:
        parsed.sourceVideoUrl === '' ? null : parsed.sourceVideoUrl ?? undefined,
      notes: parsed.notes === undefined ? undefined : parsed.notes || null,
      isActive: parsed.isActive,
      name: parsed.name,
    })

    return NextResponse.json({ playbook })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update practice playbook',
      },
      { status: 500 }
    )
  }
}
