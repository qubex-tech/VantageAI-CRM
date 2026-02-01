import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  jobId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
  }
  return NextResponse.json({
    status: 'not_implemented',
    jobId: parsed.data.jobId,
  })
}
