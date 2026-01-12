import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePracticeContext } from '@/lib/tenant'
import { messageCreateSchema } from '@/lib/validations'

/**
 * GET /api/portal/threads/[id]/messages
 * Get messages for a thread
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const { id: threadId } = await params
    
    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    // Verify thread belongs to patient
    const thread = await prisma.conversationThread.findFirst({
      where: {
        id: threadId,
        practiceId: practiceContext.practiceId,
        patientId,
      },
    })

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    const messages = await prisma.portalMessage.findMany({
      where: {
        threadId,
        practiceId: practiceContext.practiceId,
        patientId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/portal/threads/[id]/messages
 * Create a new message in a thread
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const practiceContext = await requirePracticeContext(req)
    const { id: threadId } = await params
    const body = await req.json()
    const parsed = messageCreateSchema.parse(body)

    const patientId = req.headers.get('x-patient-id')
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID required' },
        { status: 401 }
      )
    }

    // Verify thread belongs to patient
    const thread = await prisma.conversationThread.findFirst({
      where: {
        id: threadId,
        practiceId: practiceContext.practiceId,
        patientId,
      },
    })

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    // Create message
    const message = await prisma.portalMessage.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        threadId,
        channel: 'PORTAL',
        direction: 'outbound',
        subject: parsed.subject,
        body: parsed.body,
        status: 'sent',
      },
    })

    // Update thread last message time
    await prisma.conversationThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    })

    // Create audit log
    await prisma.portalAuditLog.create({
      data: {
        practiceId: practiceContext.practiceId,
        patientId,
        action: 'message_sent',
        resourceType: 'message',
        resourceId: message.id,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create message' },
      { status: 500 }
    )
  }
}
