"use client"

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type DraftConfidence = 'low' | 'medium' | 'high'
type RewriteMode = 'shorten' | 'empathetic' | 'direct' | 'spanish'

interface DraftSource {
  kb: Array<{ id: string; title: string; url?: string }>
  similar: Array<{ id: string; snippet: string }>
}

interface DraftResponse {
  draft_text: string
  citations: Array<{ label: string; sourceId: string }>
  confidence: DraftConfidence
  sources: DraftSource
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return res.json()
}

export function DraftReplyComposer({
  conversationId,
  disabled,
  onApplyDraft,
}: {
  conversationId: string | null
  disabled: boolean
  onApplyDraft: (value: string) => void
}) {
  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [undoText, setUndoText] = useState<string | null>(null)

  const canGenerate = useMemo(() => Boolean(conversationId) && !disabled, [conversationId, disabled])

  const handleGenerate = async () => {
    if (!conversationId || !canGenerate) return
    setLoading(true)
    setErrorMessage(null)
    setUndoText(null)
    try {
      const data = await fetchJson<{ data: DraftResponse }>(`/api/ai/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      })
      setDraft(data.data)
      onApplyDraft(data.data.draft_text)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Draft unavailable')
      }
      setDraft(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRewrite = async (mode: RewriteMode) => {
    if (!conversationId || !draft) return
    setLoading(true)
    setErrorMessage(null)
    setUndoText(draft.draft_text)
    try {
      const data = await fetchJson<{ data: DraftResponse }>(`/api/ai/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          rewrite_mode: mode,
        }),
      })
      setDraft(data.data)
      onApplyDraft(data.data.draft_text)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Draft unavailable')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUndo = () => {
    if (!undoText) return
    setDraft((prev) => (prev ? { ...prev, draft_text: undoText } : prev))
    onApplyDraft(undoText)
    setUndoText(null)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className={cn(
          'text-xs text-slate-500 hover:text-slate-700',
          (!canGenerate || loading) && 'cursor-not-allowed text-slate-300'
        )}
      >
        Draft reply
      </button>

      {errorMessage && (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {errorMessage}
        </div>
      )}

      {draft && (
        <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="uppercase tracking-wide text-slate-500">AI Draft</span>
            <span>{draft.confidence[0].toUpperCase() + draft.confidence.slice(1)} confidence</span>
            {loading && <span>Updating…</span>}
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{draft.draft_text}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {(['shorten', 'empathetic', 'direct', 'spanish'] as RewriteMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleRewrite(mode)}
                className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 hover:text-slate-700"
                disabled={loading}
              >
                {mode === 'shorten'
                  ? 'Shorten'
                  : mode === 'empathetic'
                    ? 'Empathetic'
                    : mode === 'direct'
                      ? 'Direct'
                      : 'Spanish'}
              </button>
            ))}
            {undoText && (
              <button
                type="button"
                onClick={handleUndo}
                className="rounded-full border border-slate-200 px-2 py-1 text-slate-500 hover:text-slate-700"
              >
                Undo
              </button>
            )}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSourcesOpen((prev) => !prev)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              {sourcesOpen ? 'Hide sources' : 'Show sources'}
            </button>
            {sourcesOpen && (
              <div className="mt-2 space-y-2 text-[11px] text-slate-500">
                <div>
                  <div className="font-semibold text-slate-500">KB Sources</div>
                  {draft.sources.kb.length ? (
                    <ul className="mt-1 space-y-1">
                      {draft.sources.kb.map((source) => (
                        <li key={source.id}>
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-slate-700"
                            >
                              {source.title}
                            </a>
                          ) : (
                            source.title
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">No KB sources available.</div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-slate-500">Similar conversations</div>
                  {draft.sources.similar.length ? (
                    <ul className="mt-1 space-y-1">
                      {draft.sources.similar.map((source) => (
                        <li key={source.id}>
                          <span className="font-medium">{source.id.slice(0, 8)}</span>
                          {source.snippet ? ` · ${source.snippet}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">No similar conversations.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
