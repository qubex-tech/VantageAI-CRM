import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import {
  bucketForDocumentReference,
  primaryTypeLabel,
  type DocumentationBucket,
} from '@/lib/ehr/documentReferenceCatalog'
import {
  fetchPatientDocumentReferences,
  isEcwDocumentationConfigured,
} from '@/lib/ehr/vantageEcwBackend'

export const dynamic = 'force-dynamic'

type DocumentationItem = {
  id: string
  bucket: DocumentationBucket
  title: string
  status?: string
  date?: string
  docStatus?: string
  typeCode?: string
  typeSystem?: string
  authorReferences: string[]
  contentSummary: Array<{
    contentType?: string
    url?: string
    title?: string
    size?: number
    hasData: boolean
  }>
}

function mapDocumentReference(resource: Record<string, unknown>): DocumentationItem | null {
  if (resource.resourceType !== 'DocumentReference' || typeof resource.id !== 'string') {
    return null
  }

  const typeCoding = Array.isArray(resource.type)
    ? undefined
    : (resource.type as { coding?: Array<{ system?: string; code?: string }> } | undefined)?.coding?.[0]

  const contentRaw = Array.isArray(resource.content) ? resource.content : []
  const contentSummary = contentRaw.map((row) => {
    const att = (row as { attachment?: Record<string, unknown> }).attachment || {}
    return {
      contentType: typeof att.contentType === 'string' ? att.contentType : undefined,
      url: typeof att.url === 'string' ? att.url : undefined,
      title: typeof att.title === 'string' ? att.title : undefined,
      size: typeof att.size === 'number' ? att.size : undefined,
      hasData: typeof att.data === 'string' && att.data.length > 0,
    }
  })

  const authors = Array.isArray(resource.author)
    ? resource.author
        .map((a) => (typeof (a as { reference?: string }).reference === 'string' ? (a as { reference: string }).reference : null))
        .filter((x): x is string => Boolean(x))
    : []

  const bucket = bucketForDocumentReference(
    resource as { type?: { coding?: Array<{ system?: string; code?: string }>; text?: string }; category?: Array<{ coding?: Array<{ code?: string }> }> }
  )

  return {
    id: resource.id,
    bucket,
    title: primaryTypeLabel(resource as { type?: { text?: string; coding?: Array<{ display?: string; code?: string }> } }),
    status: typeof resource.status === 'string' ? resource.status : undefined,
    date: typeof resource.date === 'string' ? resource.date : undefined,
    docStatus: typeof resource.docStatus === 'string' ? resource.docStatus : undefined,
    typeCode: typeCoding?.code,
    typeSystem: typeCoding?.system,
    authorReferences: authors,
    contentSummary,
  }
}

function emptyBuckets(): Record<DocumentationBucket, DocumentationItem[]> {
  return {
    insurance_and_id: [],
    clinical_notes: [],
    summaries: [],
    other: [],
  }
}

/**
 * GET /api/patients/[id]/documentation
 * Lists FHIR DocumentReference rows from eCW (Vantage Backend Services app) for the patient,
 * grouped for the Documentation profile tab.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    const { id: patientId } = await params

    if (!user.practiceId) {
      return NextResponse.json({ error: 'Practice ID is required' }, { status: 400 })
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: user.practiceId,
        deletedAt: null,
      },
      select: { id: true, externalEhrId: true },
    })

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (!isEcwDocumentationConfigured()) {
      return NextResponse.json({
        configured: false as const,
        message:
          'On the server (e.g. Vercel → Project → Settings → Environment Variables), set VANTAGE_ECW_FHIR_BASE_URL and VANTAGE_ECW_CLIENT_ID, plus either VANTAGE_ECW_CLIENT_SECRET or VANTAGE_ECW_JWT_PRIVATE_KEY (RSA PEM for Backend Services JWT). Optional: VANTAGE_ECW_CLIENT_ASSERTION_AUD (or _PROD / _SANDBOX), VANTAGE_ECW_JWT_KEY_ID, VANTAGE_ECW_SCOPE, VANTAGE_ECW_STATIC_ACCESS_TOKEN (dev only). Redeploy after saving.',
        buckets: emptyBuckets(),
      })
    }

    if (!patient.externalEhrId?.trim()) {
      return NextResponse.json({
        configured: true as const,
        patientLinked: false as const,
        message: 'This patient is not linked to eCW (missing external EHR patient id).',
        buckets: emptyBuckets(),
      })
    }

    const { raw } = await fetchPatientDocumentReferences(patient.externalEhrId)

    const bundle = raw as { resourceType?: string; entry?: Array<{ resource?: Record<string, unknown> }> }
    const entries = bundle.resourceType === 'Bundle' && Array.isArray(bundle.entry) ? bundle.entry : []

    const buckets = emptyBuckets()
    for (const entry of entries) {
      const resource = entry.resource
      if (!resource) continue
      const mapped = mapDocumentReference(resource)
      if (!mapped) continue
      buckets[mapped.bucket].push(mapped)
    }

    const sortByDate = (a: DocumentationItem, b: DocumentationItem) => {
      const da = a.date ? Date.parse(a.date) : 0
      const db = b.date ? Date.parse(b.date) : 0
      return db - da
    }
    for (const k of Object.keys(buckets) as DocumentationBucket[]) {
      buckets[k].sort(sortByDate)
    }

    return NextResponse.json({
      configured: true as const,
      patientLinked: true as const,
      buckets,
    })
  } catch (error) {
    console.error('[documentation]', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load documentation',
      },
      { status: 500 }
    )
  }
}
