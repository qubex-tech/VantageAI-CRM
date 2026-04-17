import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { primaryTypeLabel } from '@/lib/ehr/documentReferenceCatalog'
import {
  documentReferenceSubjectMatchesPatient,
  fetchDocumentReferenceById,
  isEcwDocumentationConfigured,
  resolveDocumentReferenceBody,
} from '@/lib/ehr/vantageEcwBackend'

export const dynamic = 'force-dynamic'

/**
 * GET /api/patients/:id/documentation/:documentReferenceId
 * Loads one DocumentReference from eCW and returns the first resolvable attachment (inline or URL).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentReferenceId: string }> }
) {
  try {
    const user = await requireAuth(req)
    const { id: patientId, documentReferenceId } = await params

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    if (!(await isEcwDocumentationConfigured(user.practiceId))) {
      return NextResponse.json({ error: 'ECW documentation is not configured' }, { status: 503 })
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: { id: true, externalEhrId: true },
    })

    if (!patient?.externalEhrId?.trim()) {
      return NextResponse.json({ error: 'Patient not found or not linked to eCW' }, { status: 404 })
    }

    const resource = await fetchDocumentReferenceById(documentReferenceId, user.practiceId)
    if (resource.resourceType !== 'DocumentReference') {
      return NextResponse.json({ error: 'Unexpected resource type' }, { status: 502 })
    }

    if (!documentReferenceSubjectMatchesPatient(resource, patient.externalEhrId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const resolved = await resolveDocumentReferenceBody(resource, user.practiceId)
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            'This document has no inline payload or URL attachment the server could load. It may require a different FHIR interaction in eCW.',
        },
        { status: 422 }
      )
    }

    const title = primaryTypeLabel(
      resource as { type?: { text?: string; coding?: Array<{ display?: string; code?: string }> } }
    )

    return NextResponse.json({
      documentReferenceId: typeof resource.id === 'string' ? resource.id : documentReferenceId,
      title,
      contentType: resolved.contentType,
      encoding: resolved.encoding,
      body: resolved.body,
    })
  } catch (error) {
    console.error('[documentation/document]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load document' },
      { status: 500 }
    )
  }
}
