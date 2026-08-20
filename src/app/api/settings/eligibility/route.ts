import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/middleware'
import { isVantageAdmin } from '@/lib/permissions'
import {
  getPracticeEligibilitySettings,
  listClearinghouseAdapters,
  upsertPracticeEligibilitySettings,
} from '@/lib/eligibility/clearinghouse'

const eligibilitySettingsSchema = z.object({
  primaryVendorKey: z.string().min(1).optional(),
  apiEnabled: z.boolean().optional(),
  rpaEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  defaultProviderNpi: z.string().optional().or(z.literal('')),
  defaultProviderTaxId: z.string().optional().or(z.literal('')),
  defaultProviderOrgName: z.string().optional().or(z.literal('')),
  defaultServiceType: z.string().optional(),
})

function resolvePracticeId(
  req: NextRequest,
  user: Awaited<ReturnType<typeof requireAuth>>,
  bodyPracticeId?: string
) {
  const queryPracticeId = req.nextUrl.searchParams.get('practiceId')
  let practiceId: string | null = user.practiceId
  if ((bodyPracticeId || queryPracticeId) && isVantageAdmin({ ...user, name: user.name ?? null })) {
    practiceId = bodyPracticeId || queryPracticeId
  }
  return practiceId
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const practiceId = resolvePracticeId(req, user)
    if (!practiceId) {
      return NextResponse.json({ settings: null, vendors: listClearinghouseAdapters().map(vendorPayload) })
    }

    const settings = await getPracticeEligibilitySettings(practiceId)
    const vendors = await Promise.all(
      listClearinghouseAdapters().map(async (adapter) => ({
        ...vendorPayload(adapter),
        configured: await adapter.isConfigured(practiceId),
      }))
    )

    return NextResponse.json({ settings, vendors })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eligibility settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const practiceId = resolvePracticeId(req, user, body.practiceId)
    if (!practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const parsed = eligibilitySettingsSchema.parse(body)
    const registered = new Set(listClearinghouseAdapters().map((a) => a.vendorKey))
    if (parsed.primaryVendorKey && !registered.has(parsed.primaryVendorKey)) {
      return NextResponse.json(
        { error: `Unknown eligibility vendor "${parsed.primaryVendorKey}"` },
        { status: 400 }
      )
    }

    const settings = await upsertPracticeEligibilitySettings(practiceId, {
      ...parsed,
      defaultProviderNpi:
        parsed.defaultProviderNpi !== undefined ? parsed.defaultProviderNpi || null : undefined,
      defaultProviderTaxId:
        parsed.defaultProviderTaxId !== undefined ? parsed.defaultProviderTaxId || null : undefined,
      defaultProviderOrgName:
        parsed.defaultProviderOrgName !== undefined
          ? parsed.defaultProviderOrgName || null
          : undefined,
    })

    return NextResponse.json({
      settings: await getPracticeEligibilitySettings(practiceId),
      vendors: listClearinghouseAdapters().map(vendorPayload),
      savedId: settings.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save eligibility settings' },
      { status: 500 }
    )
  }
}

function vendorPayload(adapter: { vendorKey: string; displayName: string; capabilities: unknown }) {
  return {
    vendorKey: adapter.vendorKey,
    displayName: adapter.displayName,
    capabilities: adapter.capabilities,
  }
}
