import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { brandProfileSchema } from '@/lib/validations'
import { createMarketingAuditLog } from '@/lib/marketing/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { tenantId: user.practiceId },
    })
    
    if (!brandProfile) {
      return NextResponse.json({ brandProfile: null })
    }
    
    return NextResponse.json({ brandProfile })
  } catch (error: any) {
    console.error('Error fetching brand profile:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch brand profile' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const body = await req.json()
    const validated = brandProfileSchema.parse(body)
    
    // Upsert brand profile
    const brandProfile = await prisma.brandProfile.upsert({
      where: { tenantId: user.practiceId },
      create: {
        tenantId: user.practiceId,
        ...validated,
      },
      update: validated,
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'BRAND_UPDATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: { updatedFields: Object.keys(validated) },
    })
    
    return NextResponse.json({ brandProfile })
  } catch (error: any) {
    console.error('Error updating brand profile:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update brand profile' },
      { status: 500 }
    )
  }
}
