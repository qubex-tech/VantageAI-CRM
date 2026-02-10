import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

/**
 * Upload insurance card image. Returns a ref/URL to store in cardFrontRef or cardBackRef.
 * In production, upload to blob storage (S3, Supabase Storage, etc.) and return the public URL or key.
 */
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

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, WebP, GIF) or PDF' },
        { status: 400 }
      )
    }

    // Stub: store ref only. In production, upload to blob storage and return URL or storage key.
    const ref = `/uploads/insurance/${user.practiceId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    return NextResponse.json({ ref })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
