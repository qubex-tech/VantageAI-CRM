'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertCircle, FileStack, FolderOpen, IdCard, Loader2, Stethoscope, X } from 'lucide-react'

type DocumentationBucket = 'insurance_and_id' | 'clinical_notes' | 'summaries' | 'other'

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

type ApiOk =
  | {
      configured: false
      message: string
      configGaps?: string[]
      buckets: Record<DocumentationBucket, DocumentationItem[]>
    }
  | {
      configured: true
      patientLinked: false
      message: string
      buckets: Record<DocumentationBucket, DocumentationItem[]>
    }
  | {
      configured: true
      patientLinked: true
      buckets: Record<DocumentationBucket, DocumentationItem[]>
    }

const SECTIONS: Array<{
  bucket: DocumentationBucket
  title: string
  description: string
  icon: typeof FolderOpen
}> = [
  {
    bucket: 'insurance_and_id',
    title: 'Insurance card & government ID',
    description:
      'Scanned insurance cards and government-issued identification uploaded to eCW as DocumentReference (US Core), LOINC 64290-0 and 53245-7.',
    icon: IdCard,
  },
  {
    bucket: 'clinical_notes',
    title: 'Clinical notes',
    description:
      'Consultation, H&P, progress, procedure, discharge, imaging, lab, and pathology narrative documents from eCW.',
    icon: Stethoscope,
  },
  {
    bucket: 'summaries',
    title: 'Summaries & C-CDA',
    description:
      'Patient summary and related document types (for example LOINC 34133-9) including C-CDA-style payloads when returned by eCW.',
    icon: FileStack,
  },
  {
    bucket: 'other',
    title: 'Other',
    description: 'Additional DocumentReference resources returned for this patient.',
    icon: FolderOpen,
  },
]

function formatDocDate(iso?: string) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

function contentHint(row: DocumentationItem['contentSummary'][0]) {
  const parts: string[] = []
  if (row.contentType) parts.push(row.contentType)
  if (row.hasData) parts.push('inline payload')
  if (row.url) parts.push('URL')
  return parts.length ? parts.join(' · ') : '—'
}

type DocumentBodyResponse = {
  title: string
  contentType: string
  encoding: 'utf8' | 'base64'
  body: string
  documentReferenceId?: string
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType || 'application/octet-stream' })
}

export function PatientDocumentationTab({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ApiOk | null>(null)

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewerDoc, setViewerDoc] = useState<DocumentBodyResponse | null>(null)
  const [viewerLabel, setViewerLabel] = useState('')

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
    setViewerDoc(null)
    setViewerError(null)
    setViewerLoading(false)
  }, [])

  const openDocument = useCallback(
    async (docId: string, listTitle: string) => {
      setViewerLabel(listTitle)
      setViewerOpen(true)
      setViewerLoading(true)
      setViewerError(null)
      setViewerDoc(null)
      try {
        const res = await fetch(
          `/api/patients/${encodeURIComponent(patientId)}/documentation/${encodeURIComponent(docId)}`
        )
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || `Request failed (${res.status})`)
        }
        setViewerDoc(json as DocumentBodyResponse)
      } catch (e) {
        setViewerError(e instanceof Error ? e.message : 'Failed to load document')
      } finally {
        setViewerLoading(false)
      }
    },
    [patientId]
  )

  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerOpen, closeViewer])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/patients/${patientId}/documentation`)
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Request failed')
        }
        if (!cancelled) setPayload(json as ApiOk)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load documentation')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [patientId])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading documentation from eClinicalWorks…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div>{error}</div>
      </div>
    )
  }

  if (!payload) return null

  if (!payload.configured) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">EHR documentation is not connected</p>
            <p className="mt-1 text-amber-900/90">{payload.message}</p>
            {payload.configGaps && payload.configGaps.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-950/95">
                {payload.configGaps.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-amber-900/80">
              After saving variables, redeploy. If you already added them, confirm they apply to this environment
              (Production vs Preview) and that the deployment finished after the save.
            </p>
          </div>
        </div>
        <EcwScopeCallout />
      </div>
    )
  }

  if (!payload.patientLinked) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-gray-500" />
          <div>
            <p className="font-medium">Patient not linked to eCW</p>
            <p className="mt-1 text-gray-600">{payload.message}</p>
          </div>
        </div>
        <EcwScopeCallout />
      </div>
    )
  }

  const total = SECTIONS.reduce((acc, s) => acc + payload.buckets[s.bucket].length, 0)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documentation</h2>
        <p className="mt-1 text-sm text-gray-600">
          Documents stored in eClinicalWorks for this patient (US Core DocumentReference), grouped by type.
          {total > 0 ? ` Showing ${total} document${total === 1 ? '' : 's'}.` : ' No documents returned for category clinical-note.'}
        </p>
        {total > 0 && (
          <p className="mt-1 text-xs text-gray-500">Double-click a row to open the document body from eCW.</p>
        )}
      </div>

      <EcwScopeCallout />

      {viewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={closeViewer}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-viewer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <h4 id="doc-viewer-title" className="truncate text-sm font-semibold text-gray-900">
                  {viewerDoc?.title || viewerLabel}
                </h4>
                {viewerDoc && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {viewerDoc.contentType}
                    {viewerDoc.encoding === 'base64' ? ' · binary' : ' · text'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeViewer}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-[200px] flex-1 overflow-auto bg-gray-50 p-3">
              {viewerLoading && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading document…
                </div>
              )}
              {viewerError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {viewerError}
                </div>
              )}
              {!viewerLoading && !viewerError && viewerDoc && <DocumentBodyView doc={viewerDoc} />}
            </div>
          </div>
        </div>
      )}

      {SECTIONS.map(({ bucket, title, description, icon: Icon }) => {
        const rows = payload.buckets[bucket]
        return (
          <section key={bucket} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {rows.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{description}</p>
            </div>
            {rows.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-500">No documents in this category.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((doc) => (
                  <li
                    key={doc.id}
                    className="cursor-pointer px-5 py-4 hover:bg-gray-50/80"
                    title="Double-click to open document"
                    onDoubleClick={() => openDocument(doc.id, doc.title)}
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{doc.title}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>Date: {formatDocDate(doc.date)}</span>
                          {doc.status && <span>Status: {doc.status}</span>}
                          {doc.docStatus && <span>Doc status: {doc.docStatus}</span>}
                          {doc.typeCode && (
                            <span>
                              Code: {doc.typeCode}
                              {doc.typeSystem ? ` (${doc.typeSystem})` : ''}
                            </span>
                          )}
                        </div>
                        {doc.authorReferences.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Author: {doc.authorReferences.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 sm:mt-0 sm:text-right">
                        <div className="font-mono text-[11px] text-gray-400">DocumentReference/{doc.id}</div>
                      </div>
                    </div>
                    {doc.contentSummary.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Content: </span>
                        {doc.contentSummary.map((c, i) => (
                          <span key={i}>
                            {i > 0 ? ' · ' : ''}
                            {contentHint(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function DocumentBodyView({ doc }: { doc: DocumentBodyResponse }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (doc.encoding !== 'base64') return
    const url = URL.createObjectURL(base64ToBlob(doc.body, doc.contentType))
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [doc.body, doc.contentType, doc.encoding])

  if (doc.encoding === 'utf8') {
    const ct = doc.contentType.toLowerCase()
    if (ct.includes('html')) {
      return (
        <iframe
          title="Document"
          className="h-[min(70vh,720px)] w-full rounded border border-gray-200 bg-white"
          sandbox=""
          srcDoc={doc.body}
        />
      )
    }
    return (
      <pre className="max-h-[min(70vh,720px)] overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-white p-3 text-xs text-gray-900">
        {doc.body}
      </pre>
    )
  }

  if (!objectUrl) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Preparing preview…
      </div>
    )
  }

  const ct = doc.contentType.toLowerCase()
  if (ct.includes('pdf')) {
    return (
      <iframe title="PDF document" src={objectUrl} className="h-[min(70vh,720px)] w-full rounded border border-gray-200 bg-white" />
    )
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
      <p className="mb-3">No inline preview for this MIME type.</p>
      <a
        href={objectUrl}
        download={`document.${ct.includes('xml') ? 'xml' : 'bin'}`}
        className="font-medium text-blue-600 underline hover:text-blue-800"
      >
        Download file
      </a>
    </div>
  )
}

function EcwScopeCallout() {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs text-blue-950">
      <p className="font-medium text-blue-900">eCW Vantage — Backend Services</p>
      <p className="mt-1 text-blue-900/85">
        Requires <code className="rounded bg-blue-100/80 px-1">system/DocumentReference.read</code> and a linked
        patient <code className="rounded bg-blue-100/80 px-1">externalEhrId</code>. FHIR base and client id may use{' '}
        <code className="rounded bg-blue-100/80 px-1">VANTAGE_ECW_*</code> or shared{' '}
        <code className="rounded bg-blue-100/80 px-1">EHR_ECW_FHIR_BASE_URL</code> /{' '}
        <code className="rounded bg-blue-100/80 px-1">EHR_ECW_CLIENT_ID</code>. JWT auth accepts{' '}
        <code className="rounded bg-blue-100/80 px-1">EHR_JWT_PRIVATE_KEY</code> (same as the main CRM). Secrets live
        only in the host environment (e.g. Vercel), not in git.
      </p>
    </div>
  )
}
