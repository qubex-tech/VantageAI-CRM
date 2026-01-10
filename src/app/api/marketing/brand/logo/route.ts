import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { createMarketingAuditLog } from '@/lib/marketing/audit'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Stub implementation - in production, upload to S3/Cloudinary/etc
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    
    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }
    
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }
    
    // Stub: In production, upload to cloud storage and return URL
    // For now, return a placeholder URL
    const logoUrl = `/uploads/logos/${user.practiceId}/${Date.now()}-${file.name}`
    
    // Update brand profile with logo URL
    const brandProfile = await prisma.brandProfile.upsert({
      where: { tenantId: user.practiceId },
      create: {
        tenantId: user.practiceId,
        practiceName: user.name || 'Practice',
        defaultFromName: user.name || 'Practice',
        defaultFromEmail: user.email || 'noreply@practice.com',
        logoUrl,
      },
      update: { logoUrl },
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'BRAND_UPDATED',
      entityType: 'BrandProfile',
      entityId: brandProfile.id,
      metadata: { logoUploaded: true, fileName: file.name, fileSize: file.size },
    })
    
    return NextResponse.json({ url: logoUrl })
  } catch (error: any) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload logo' },
      { status: 500 }
    )
  }
}
