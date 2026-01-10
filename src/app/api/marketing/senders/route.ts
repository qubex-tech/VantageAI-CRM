import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { z } from 'zod'
import { createMarketingAuditLog } from '@/lib/marketing/audit'

export const dynamic = 'force-dynamic'

const sendersSchema = z.object({
  defaultFromName: z.string().min(1, 'From name is required'),
  defaultFromEmail: z.string().email('From email must be valid'),
  defaultReplyToEmail: z.string().email('Reply-to email must be valid').optional().nullable(),
  defaultSmsSenderId: z.string().optional().nullable(),
  quietHoursStart: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Quiet hours start must be in HH:mm format'),
  quietHoursEnd: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Quiet hours end must be in HH:mm format'),
  timezone: z.string().default('America/Chicago'),
})

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
      select: {
        defaultFromName: true,
        defaultFromEmail: true,
        defaultReplyToEmail: true,
        defaultSmsSenderId: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        timezone: true,
      },
    })
    
    if (!brandProfile) {
      return NextResponse.json({
        defaultFromName: user.name || 'Practice',
        defaultFromEmail: user.email || 'noreply@practice.com',
        defaultReplyToEmail: null,
        defaultSmsSenderId: null,
        quietHoursStart: '09:00',
        quietHoursEnd: '17:00',
        timezone: 'America/Chicago',
      })
    }
    
    return NextResponse.json(brandProfile)
  } catch (error: any) {
    console.error('Error fetching sender settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sender settings' },
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
    const validated = sendersSchema.parse(body)
    
    // Update or create brand profile with sender settings
    const brandProfile = await prisma.brandProfile.upsert({
      where: { tenantId: user.practiceId },
      create: {
        tenantId: user.practiceId,
        practiceName: user.name || 'Practice',
        ...validated,
      },
      update: validated,
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'SENDERS_UPDATED',
      entityType: 'Senders',
      entityId: brandProfile.id,
      metadata: { updatedFields: Object.keys(validated) },
    })
    
    return NextResponse.json({
      defaultFromName: brandProfile.defaultFromName,
      defaultFromEmail: brandProfile.defaultFromEmail,
      defaultReplyToEmail: brandProfile.defaultReplyToEmail,
      defaultSmsSenderId: brandProfile.defaultSmsSenderId,
      quietHoursStart: brandProfile.quietHoursStart,
      quietHoursEnd: brandProfile.quietHoursEnd,
      timezone: brandProfile.timezone,
    })
  } catch (error: any) {
    console.error('Error updating sender settings:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update sender settings' },
      { status: 500 }
    )
  }
}
