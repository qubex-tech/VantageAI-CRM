import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Public lead-capture endpoint for the getvantage.tech marketing site
 * ("Contact Us" / "Get Started" form). Unauthenticated by design, so it is
 * intentionally narrow: strict validation, a honeypot, and field length caps.
 */

const ALLOWED_ORIGINS = [
  'https://getvantage.tech',
  'https://www.getvantage.tech',
  'http://localhost:3000',
  'http://localhost:5173',
]

function resolveOrigin(origin: string | null): string {
  if (origin && ALLOWED_ORIGINS.includes(origin.toLowerCase())) return origin
  return ALLOWED_ORIGINS[0]
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const leadSchema = z.object({
  practiceName: z.string().trim().min(1, 'Practice name is required').max(200),
  contactName: z.string().trim().min(1, 'Your name is required').max(200),
  workEmail: z.string().trim().email('A valid work email is required').max(320),
  practiceWebsite: z.string().trim().max(300).optional().or(z.literal('')),
  practiceType: z.enum([
    'Dental',
    'Primary care',
    'Specialty clinic',
    'Multi-specialty',
    'Other',
  ]),
  providerCount: z.enum(['1', '2-5', '6-10', '11+']),
  automationFocus: z.enum([
    'Answering calls',
    'Scheduling & reminders',
    'Follow-ups & reactivation',
    'All of the above',
  ]),
  source: z.string().trim().max(120).optional(),
  // Honeypot — real users never fill this; bots often do.
  company: z.string().max(0).optional().or(z.literal('')),
})

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers })
  }

  const parsed = leadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422, headers }
    )
  }

  const data = parsed.data

  // Honeypot tripped — pretend success, store nothing.
  if (data.company) {
    return NextResponse.json({ ok: true }, { status: 200, headers })
  }

  try {
    const lead = await prisma.marketingLead.create({
      data: {
        practiceName: data.practiceName,
        contactName: data.contactName,
        workEmail: data.workEmail,
        practiceWebsite: data.practiceWebsite || null,
        practiceType: data.practiceType,
        providerCount: data.providerCount,
        automationFocus: data.automationFocus,
        source: data.source || null,
        referrer: req.headers.get('referer'),
        userAgent: req.headers.get('user-agent'),
      },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201, headers })
  } catch (err) {
    console.error('[leads] failed to store lead:', err)
    return NextResponse.json({ ok: false, error: 'Could not save submission' }, { status: 500, headers })
  }
}
