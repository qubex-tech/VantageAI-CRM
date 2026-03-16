'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PreVisitChartType } from '@/lib/previsit/types'

interface PreVisitChartTabProps {
  patientId: string
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

export function PreVisitChartTab({ patientId }: PreVisitChartTabProps) {
  const [chartType, setChartType] = useState<PreVisitChartType>('new_patient')
  const [chart, setChart] = useState<PreVisitChartRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [qaMessages, setQaMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; references?: Array<{ number: number; sourceId: string }> }>>([])
  const [error, setError] = useState('')

  const referencesByNumber = useMemo(() => {
    const map = new Map<number, { number: number; sourceId: string; source: { title: string; snippet: string; sourceType: string } }>()
    const refs = chart?.generationMeta?.references || []
    for (const reference of refs) {
      map.set(reference.number, reference)
    }
    return map
  }, [chart?.generationMeta?.references])

  const evidenceItems = chart?.evidenceBundle?.evidenceItems || []

  const loadChart = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load pre-visit chart')
      }
      if (data.chart) {
        setChart(data.chart)
        setChartType(data.chart.chartType || 'new_patient')
      } else {
        setChart(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pre-visit chart')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadChart()
  }, [patientId])

  const generateChart = async (forceRegenerate = false) => {
    setGenerating(true)
    setError('')
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartType, forceRegenerate }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate pre-visit chart')
      }
      setChart(data.chart)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate pre-visit chart')
    } finally {
      setGenerating(false)
    }
  }

  const askQuestion = async () => {
    if (!question.trim()) return
    const askedQuestion = question.trim()
    setAsking(true)
    setError('')
    setQuestion('')
    setQaMessages((prev) => [...prev, { role: 'user', content: askedQuestion }])
    try {
      const response = await fetch(`/api/patients/${patientId}/pre-visit-chart/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: askedQuestion, chartType }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get Healix answer')
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
      const message = err instanceof Error ? err.message : 'Failed to get Healix answer'
      setError(message)
      setQaMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Unable to answer: ${message}`,
        },
      ])
    } finally {
      setAsking(false)
    }
  }

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
          <Button type="button" size="sm" onClick={() => void generateChart(Boolean(chart))} disabled={generating}>
            {generating ? 'Generating...' : chart ? 'Regenerate' : 'Generate Pre-Visit Chart'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3 rounded-lg border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Patient Records & Sources</h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {evidenceItems.length === 0 ? (
              <p className="text-sm text-gray-500">Generate a pre-visit chart to load source evidence.</p>
            ) : (
              evidenceItems.map((item) => (
                <div key={item.sourceId} className="rounded border p-2">
                  <div className="text-xs font-medium text-gray-700">{item.title}</div>
                  <div className="text-[11px] text-gray-500">{item.sourceType}</div>
                  <div className="mt-1 text-xs text-gray-700">{item.snippet}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-6 rounded-lg border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Pre-Visit Chart</h3>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {!chart ? (
              <p className="text-sm text-gray-500">No chart generated yet.</p>
            ) : chart.status === 'failed' ? (
              <p className="text-sm text-red-600">Last generation failed. Regenerate to try again.</p>
            ) : (
              chart.generatedSections?.map((section) => (
                <div key={section.id} className="rounded border p-3">
                  <h4 className="text-sm font-semibold text-gray-900">{section.title}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{section.content}</p>
                  {section.references && section.references.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {section.references.map((reference) => (
                        <span key={`${section.id}-${reference.number}`} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          [{reference.number}]
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="xl:col-span-3 rounded-lg border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Ask Healix</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {qaMessages.length === 0 ? (
              <p className="text-sm text-gray-500">Ask patient-specific questions. Responses include evidence references.</p>
            ) : (
              qaMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded p-2 text-sm ${message.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}
                >
                  <div className="text-[11px] uppercase opacity-70">{message.role}</div>
                  <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
                  {message.references && message.references.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.references.map((reference) => (
                        <span key={`${index}-${reference.number}`} className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-gray-700">
                          [{reference.number}]
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="mt-3 space-y-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this patient..."
              disabled={asking}
            />
            <Button type="button" className="w-full" onClick={() => void askQuestion()} disabled={asking || !question.trim()}>
              {asking ? 'Asking...' : 'Ask Healix'}
            </Button>
          </div>
        </div>
      </div>

      {chart?.generationMeta?.references && chart.generationMeta.references.length > 0 ? (
        <div className="rounded-lg border bg-white p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Numbered References</h3>
          <div className="space-y-2">
            {Array.from(referencesByNumber.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([number, reference]) => (
                <div key={number} className="text-sm text-gray-700">
                  <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs">[{number}]</span>
                  <span className="font-medium">{reference.source.title}</span>
                  <span className="ml-2 text-xs text-gray-500">{reference.source.sourceType}</span>
                  <div className="mt-1 text-xs text-gray-600">{reference.source.snippet}</div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
