import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const { id } = await params
    const check = await prisma.eligibilityCheck.findFirst({
      where: { id, practiceId: user.practiceId },
      include: {
        policy: {
          select: {
            id: true,
            payerNameRaw: true,
            memberId: true,
            eligibilityStatus: true,
            lastEligibilityCheckedAt: true,
          },
        },
      },
    })

    if (!check) {
      return NextResponse.json({ error: 'Eligibility check not found' }, { status: 404 })
    }

    return NextResponse.json({ check })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eligibility check' },
      { status: 500 }
    )
  }
}
