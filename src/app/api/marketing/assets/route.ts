import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
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
    
    const assets = await prisma.marketingTemplateAsset.findMany({
      where: { tenantId: user.practiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    
    return NextResponse.json({ assets })
  } catch (error: any) {
    console.error('Error fetching assets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}

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
    
    // Determine asset type
    const assetType = file.type.startsWith('image/') ? 'image' : 'file'
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }
    
    // Stub: In production, upload to cloud storage and return URL
    const url = `/uploads/marketing/${user.practiceId}/${Date.now()}-${file.name}`
    
    // Extract metadata for images
    let meta: any = undefined
    if (assetType === 'image') {
      // In production, get actual dimensions from uploaded image
      meta = {
        type: file.type,
        size: file.size,
        filename: file.name,
      }
    } else {
      meta = {
        type: file.type,
        size: file.size,
        filename: file.name,
      }
    }
    
    // Create asset record
    const asset = await prisma.marketingTemplateAsset.create({
      data: {
        tenantId: user.practiceId,
        type: assetType,
        url,
        meta: meta as any,
        createdByUserId: user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
    
    // Audit log
    await createMarketingAuditLog({
      tenantId: user.practiceId,
      actorUserId: user.id,
      actorType: 'staff',
      action: 'ASSET_UPLOADED',
      entityType: 'Asset',
      entityId: asset.id,
      metadata: { type: assetType, fileName: file.name, fileSize: file.size },
    })
    
    return NextResponse.json({ asset }, { status: 201 })
  } catch (error: any) {
    console.error('Error uploading asset:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload asset' },
      { status: 500 }
    )
  }
}
