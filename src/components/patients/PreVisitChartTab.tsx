'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { PreVisitChartType } from '@/lib/previsit/types'
import { cn } from '@/lib/utils'

interface PreVisitChartTabProps {
  patientId: string
}

interface ApiErrorState {
  message: string
  code?: string
}

interface ApiError extends Error {
  code?: string
}

interface PreVisitChartRecord {
  id: string
  chartType: PreVisitChartType
  status: 'draft' | 'generated' | 'failed'
  generatedSections: Array<{
    id: string
    title: string
    content: string
    references?: Array<{ number: number; sourceId: string }>
  }>
  evidenceBundle?: {
    evidenceItems?: Array<{
      sourceId: string
      sourceType: string
      title: string
      snippet: string
      locator?: Record<string, unknown>
    }>
  }
  generationMeta?: {
    generatedAt?: string
    model?: string
    evidenceItemsSentToModel?: number
    references?: Array<{
      number: number
      sourceId: string
      source: {
        sourceType: string
        title: string
        snippet: string
        locator?: Record<string, unknown>
      }
    }>
  }
}

const ASK_SUGGESTIONS = [
  'What changed since the last visit?',
  'Any medication risks for this patient?',
  'Summarize labs trend over the last 6 months.',
]

const SOURCE_GROUPS = [
  { id: 'patient', label: 'Patient', sourceTypes: ['patient_profile'] },
  { id: 'notes', label: 'Notes', sourceTypes: ['patient_note', 'timeline_entry'] },
  { id: 'appointments', label: 'Appointments', sourceTypes: ['appointment'] },
  { id: 'labs_forms', label: 'Labs & Forms', sourceTypes: ['form_submission'] },
  { id: 'consults_docs', label: 'Consults & Documents', sourceTypes: ['document_upload', 'insurance'] },
  { id: 'kb', label: 'Knowledge Base', sourceTypes: ['knowledge_base'] },
]

function getSourceGroupId(sourceType: string) {
  const group = SOURCE_GROUPS.find((entry) => entry.sourceTypes.includes(sourceType))
  return group?.id ?? 'other'
}

function formatGeneratedAt(value?: string) {
  if (!value) return 'Not generated yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not generated yet'
  return date.toLocaleString()
}

function toApiError(data: any, fallback: string) {
  const error = new Error(data?.error || fallback) as ApiError
  if (typeof data?.code === 'string') {
    error.code = data.code
  }
  return error
}

export function PreVisitChartTab({ patientId }: PreVisitChartTabProps) {
  const [chartType, setChartType] = useState<PreVisitChartType>('new_patient')
  const [chart, setChart] = useState<PreVisitChartRecord | null>(null)
  const [lastSuccessfulChart, setLastSuccessfulChart] = useState<PreVisitChartRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationPhase, setGenerationPhase] = useState('')
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [qaMessages, setQaMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; references?: Array<{ number: number; sourceId: string }> }>
  >([])
  const [error, setError] = useState<ApiErrorState | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [activeReferenceNumber, setActiveReferenceNumber] = useState<number | null>(null)
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [showGenerationDetails, setShowGenerationDetails] = useState(false)
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'summary'>('chat')

  const generationTimers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const askAbortRef = useRef<AbortController | null>(null)

  const displayedChart =
    chart?.status === 'failed' && lastSuccessfulChart ? lastSuccessfulChart : chart
  const showingFallbackChart = chart?.status === 'failed' && Boolean(lastSuccessfulChart)

  const evidenceItems = displayedChart?.evidenceBundle?.evidenceItems || []
  const sections = displayedChart?.generatedSections || []
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0] || null

  const referencesByNumber = useMemo(() => {
    const map = new Map<number, { number: number; sourceId: string; source: { title: string; snippet: string; sourceType: string } }>()
    const refs = displayedChart?.generationMeta?.references || []
    for (const reference of refs) {
      map.set(reference.number, reference)
    }
    return map
  }, [displayedChart?.generationMeta?.references])

  const groupedEvidence = useMemo(() => {
    const byGroup = new Map<string, { label: string; items: typeof evidenceItems }>()
    for (const group of SOURCE_GROUPS) {
      byGroup.set(group.id, { label: group.label, items: [] })
    }
    byGroup.set('other', { label: 'Other', items: [] })

    for (const item of evidenceItems) {
      const groupId = getSourceGroupId(item.sourceType)
      const existing = byGroup.get(groupId)
      if (existing) {
        existing.items.push(item)
      }
    }

    return Array.from(byGroup.entries())
      .map(([groupId, value]) => ({ groupId, ...value }))
      .filter((group) => group.items.length > 0)
  }, [evidenceItems])

  const selectedEvidenceItem = useMemo(() => {
    if (!evidenceItems.length) return null
    return evidenceItems.find((item) => item.sourceId === activeSourceId) || evidenceItems[0]
  }, [activeSourceId, evidenceItems])

  const summaryHighlights = useMemo(() => {
    return sections.map((section) => {
      const excerpt = section.content.trim().slice(0, 180)
      return {
        id: section.id,
        title: section.title,
        excerpt: excerpt.length < section.content.trim().length ? `${excerpt}...` : excerpt,
      }
    })
  }, [sections])

  const clearGenerationTimers = () => {
    for (const timer of generationTimers.current) {
      clearTimeout(timer)
    }
    generationTimers.current = []
  }

  const startGenerationPhases = () => {
    clearGenerationTimers()
    setGenerationPhase('Collecting evidence...')
    generationTimers.current.push(setTimeout(() => setGenerationPhase('Generating chart sections...'), 1400))
    generationTimers.current.push(setTimeout(() => setGenerationPhase('Validating citations...'), 3400))
  }

  const handleReferenceClick = (reference: { number: number; sourceId: string }) => {
    setActiveReferenceNumber(reference.number)
    setActiveSourceId(reference.sourceId)
    const element = document.getElementById(`previsit-reference-${reference.number}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const loadChart = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw toApiError(data, 'Failed to load pre-visit chart')
      }
      if (data.chart) {
        setChart(data.chart)
        if (data.chart.status === 'generated') {
          setLastSuccessfulChart(data.chart)
        }
        setChartType(data.chart.chartType || 'new_patient')
      } else {
        setChart(null)
      }
    } catch (err) {
      const apiError = err as ApiError
      setError({
        message: apiError instanceof Error ? apiError.message : 'Failed to load pre-visit chart',
        code: typeof apiError?.code === 'string' ? apiError.code : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadChart()
  }, [patientId])

  useEffect(() => {
    if (sections.length === 0) {
      setActiveSectionId(null)
      return
    }
    const existing = sections.some((section) => section.id === activeSectionId)
    if (!existing) {
      setActiveSectionId(sections[0].id)
    }
  }, [activeSectionId, sections])

  useEffect(() => {
    if (groupedEvidence.length === 0) return
    setCollapsedGroups((prev) => {
      const next = { ...prev }
      for (const group of groupedEvidence) {
        if (!(group.groupId in next)) {
          next[group.groupId] = false
        }
      }
      return next
    })
  }, [groupedEvidence])

  useEffect(() => {
    if (!selectedEvidenceItem) {
      setActiveSourceId(null)
      return
    }
    if (!activeSourceId) {
      setActiveSourceId(selectedEvidenceItem.sourceId)
    }
  }, [activeSourceId, selectedEvidenceItem])

  const generateChart = async (forceRegenerate = false) => {
    setGenerating(true)
    setError(null)
    startGenerationPhases()
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartType, forceRegenerate }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw toApiError(data, 'Failed to generate pre-visit chart')
      }
      setChart(data.chart)
      if (data.chart?.status === 'generated') {
        setLastSuccessfulChart(data.chart)
      }
    } catch (err) {
      const apiError = err as ApiError
      setError({
        message: apiError instanceof Error ? apiError.message : 'Failed to generate pre-visit chart',
        code: typeof apiError?.code === 'string' ? apiError.code : undefined,
      })
    } finally {
      clearGenerationTimers()
      setGenerationPhase('')
      setGenerating(false)
    }
  }

  const askQuestion = async () => {
    if (!question.trim()) return
    const askedQuestion = question.trim()
    const abortController = new AbortController()
    askAbortRef.current = abortController
    setAsking(true)
    setError(null)
    setQuestion('')
    setQaMessages((prev) => [...prev, { role: 'user', content: askedQuestion }])
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: askedQuestion, chartType }),
        signal: abortController.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw toApiError(data, 'Failed to get Healix answer')
      }
      setQaMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          references: data.references || [],
        },
      ])
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      const message = isAbort
        ? 'Question cancelled.'
        : err instanceof Error
          ? err.message
          : 'Failed to get Healix answer'
      const apiError = err as ApiError
      setError({
        message,
        code: typeof apiError?.code === 'string' ? apiError.code : undefined,
      })
      setQaMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Unable to answer: ${message}`,
        },
      ])
    } finally {
      askAbortRef.current = null
      setAsking(false)
    }
  }

  const cancelAsk = () => {
    askAbortRef.current?.abort()
  }

  const errorToneClass =
    error?.code === 'MIGRATION_REQUIRED'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-red-200 bg-red-50 text-red-700'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={chartType === 'new_patient' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('new_patient')}
          >
            New Patient
          </Button>
          <Button
            type="button"
            variant={chartType === 'follow_up' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('follow_up')}
          >
            Follow-up
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadChart()} disabled={loading}>
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => void generateChart(Boolean(chart))} disabled={generating || loading}>
            {generating ? 'Generating...' : chart ? 'Regenerate' : 'Generate Pre-Visit Chart'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-700">
        <span className="font-medium">Chart Type:</span>
        <span className="rounded bg-white px-2 py-0.5">{chartType === 'new_patient' ? 'New Patient' : 'Follow-up'}</span>
        <span className="font-medium">Status:</span>
        <span
          className={cn(
            'rounded px-2 py-0.5',
            displayedChart?.status === 'generated' && 'bg-emerald-100 text-emerald-700',
            displayedChart?.status === 'failed' && 'bg-red-100 text-red-700',
            (!displayedChart || displayedChart?.status === 'draft') && 'bg-gray-200 text-gray-700'
          )}
        >
          {displayedChart?.status || 'not started'}
        </span>
        <span className="font-medium">Generated:</span>
        <span>{formatGeneratedAt(displayedChart?.generationMeta?.generatedAt)}</span>
        <span className="font-medium">Evidence:</span>
        <span>{evidenceItems.length}</span>
      </div>

      {generationPhase ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{generationPhase}</div>
      ) : null}

      {showingFallbackChart ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Regeneration failed. Showing your last successful chart while you retry.
        </div>
      ) : null}

      {error ? (
        <div className={cn('space-y-2 rounded-md border px-3 py-2 text-sm', errorToneClass)}>
          <div>{error.message}</div>
          {error.code === 'GENERATION_TIMEOUT' ? (
            <div className="text-xs">Tip: try once more, or switch chart type for a lighter first pass.</div>
          ) : null}
          {error.code === 'MIGRATION_REQUIRED' ? (
            <div className="text-xs">The environment is missing required DB migrations.</div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void generateChart(Boolean(chart))} disabled={generating}>
              Retry generate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setChartType((prev) => (prev === 'new_patient' ? 'follow_up' : 'new_patient'))}
            >
              Switch chart type
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadChart()} disabled={loading}>
              Refresh evidence
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3 rounded-lg border bg-white p-3 h-[72vh] flex flex-col">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Patient Records & Sources</h3>
          <div className="space-y-3 overflow-y-auto pr-1 flex-1">
            {loading && !displayedChart ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded border bg-gray-100" />
                ))}
              </div>
            ) : evidenceItems.length === 0 ? (
              <p className="text-sm text-gray-500">Generate a pre-visit chart to load source evidence.</p>
            ) : (
              groupedEvidence.map((group) => (
                <div key={group.groupId} className="rounded border">
                  <button
                    type="button"
                    className="w-full border-b bg-gray-50 px-2 py-1.5 text-left text-xs font-medium text-gray-700"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.groupId]: !prev[group.groupId],
                      }))
                    }
                  >
                    {group.label} ({group.items.length})
                  </button>
                  {!collapsedGroups[group.groupId] ? (
                    <div className="space-y-1 p-1.5">
                      {group.items.map((item) => (
                        <button
                          type="button"
                          key={item.sourceId}
                          className={cn(
                            'w-full rounded border p-2 text-left',
                            activeSourceId === item.sourceId
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          )}
                          onClick={() => setActiveSourceId(item.sourceId)}
                        >
                          <div className="text-xs font-medium text-gray-700">{item.title}</div>
                          <div className="text-[11px] text-gray-500">{item.sourceType}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {selectedEvidenceItem ? (
            <div className="mt-3 rounded border bg-gray-50 p-2">
              <div className="text-xs font-semibold text-gray-800">Source Preview</div>
              <div className="mt-1 text-xs font-medium text-gray-700">{selectedEvidenceItem.title}</div>
              <div className="text-[11px] text-gray-500">{selectedEvidenceItem.sourceType}</div>
              <div className="mt-1 text-xs text-gray-700">{selectedEvidenceItem.snippet}</div>
              {selectedEvidenceItem.locator ? (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-white p-1 text-[11px] text-gray-600">
                  {JSON.stringify(selectedEvidenceItem.locator, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="xl:col-span-6 rounded-lg border bg-white h-[72vh] flex flex-col">
          <div className="sticky top-0 z-10 border-b bg-white px-3 py-2">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Pre-Visit Chart</h3>
            {sections.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={cn(
                      'rounded px-2 py-1 text-xs',
                      activeSection?.id === section.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-y-auto p-3 flex-1">
            {!displayedChart ? (
              <p className="text-sm text-gray-500">No chart generated yet.</p>
            ) : displayedChart.status === 'failed' && !showingFallbackChart ? (
              <p className="text-sm text-red-600">Last generation failed. Regenerate to try again.</p>
            ) : activeSection ? (
              <div className="rounded border p-3">
                <h4 className="text-sm font-semibold text-gray-900">{activeSection.title}</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{activeSection.content}</p>
                {activeSection.references && activeSection.references.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeSection.references.map((reference) => (
                      <button
                        type="button"
                        key={`${activeSection.id}-${reference.number}`}
                        className={cn(
                          'rounded px-2 py-0.5 text-xs',
                          activeReferenceNumber === reference.number
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                        onClick={() => handleReferenceClick(reference)}
                      >
                        [{reference.number}]
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No section content available.</p>
            )}
          </div>
        </div>

        <div className="xl:col-span-3 rounded-lg border bg-white p-3 h-[72vh] flex flex-col">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Ask Healix</h3>

          <div className="mb-2 flex gap-1 rounded bg-gray-100 p-1">
            <button
              type="button"
              className={cn(
                'flex-1 rounded px-2 py-1 text-xs font-medium',
                rightPanelMode === 'chat' ? 'bg-white text-gray-900' : 'text-gray-500'
              )}
              onClick={() => setRightPanelMode('chat')}
            >
              Chat
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded px-2 py-1 text-xs font-medium',
                rightPanelMode === 'summary' ? 'bg-white text-gray-900' : 'text-gray-500'
              )}
              onClick={() => setRightPanelMode('summary')}
            >
              Summary
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 flex-1">
            {rightPanelMode === 'chat' ? (
              qaMessages.length === 0 ? (
                <p className="text-sm text-gray-500">Ask patient-specific questions. Responses include evidence references.</p>
              ) : (
                qaMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      'rounded p-2 text-sm',
                      message.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    <div className="text-[11px] uppercase opacity-70">{message.role}</div>
                    <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                    {message.references && message.references.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.references.map((reference) => (
                          <button
                            type="button"
                            key={`${index}-${reference.number}`}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[11px]',
                              activeReferenceNumber === reference.number
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-white/70 text-gray-700 hover:bg-white'
                            )}
                            onClick={() => handleReferenceClick(reference)}
                          >
                            [{reference.number}]
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )
            ) : summaryHighlights.length > 0 ? (
              <div className="space-y-2">
                {summaryHighlights.map((summary) => (
                  <button
                    type="button"
                    key={summary.id}
                    className={cn(
                      'w-full rounded border p-2 text-left',
                      activeSection?.id === summary.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    )}
                    onClick={() => setActiveSectionId(summary.id)}
                  >
                    <div className="text-xs font-semibold text-gray-800">{summary.title}</div>
                    <div className="mt-1 text-xs text-gray-600">{summary.excerpt || 'No summary text available.'}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Generate a chart to view summary insights.</p>
            )}
          </div>

          {rightPanelMode === 'chat' ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-1">
                {ASK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-200"
                    onClick={() => setQuestion(suggestion)}
                    disabled={asking}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about this patient..."
                disabled={asking}
                rows={3}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void askQuestion()
                  }
                }}
              />
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={() => void askQuestion()} disabled={asking || !question.trim()}>
                  {asking ? 'Asking...' : 'Ask Healix'}
                </Button>
                {asking ? (
                  <Button type="button" variant="outline" onClick={cancelAsk}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {displayedChart?.generationMeta?.references && displayedChart.generationMeta.references.length > 0 ? (
        <div className="rounded-lg border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Numbered References</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowGenerationDetails((prev) => !prev)}>
              {showGenerationDetails ? 'Hide Details' : 'Details'}
            </Button>
          </div>

          {showGenerationDetails ? (
            <div className="mb-3 rounded border bg-gray-50 p-2 text-xs text-gray-600">
              <div>Model: {displayedChart.generationMeta.model || 'unknown'}</div>
              <div>Generated at: {formatGeneratedAt(displayedChart.generationMeta.generatedAt)}</div>
              <div>Evidence sent to model: {displayedChart.generationMeta.evidenceItemsSentToModel ?? evidenceItems.length}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            {Array.from(referencesByNumber.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([number, reference]) => (
                <button
                  key={number}
                  id={`previsit-reference-${number}`}
                  type="button"
                  className={cn(
                    'w-full rounded border p-2 text-left text-sm',
                    activeReferenceNumber === number
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  )}
                  onClick={() => handleReferenceClick(reference)}
                >
                  <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs">[{number}]</span>
                  <span className="font-medium">{reference.source.title}</span>
                  <span className="ml-2 text-xs text-gray-500">{reference.source.sourceType}</span>
                  <div className="mt-1 text-xs text-gray-600">{reference.source.snippet}</div>
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
