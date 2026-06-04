import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, X, Users, Plus } from 'lucide-react'
import type { PlayMaker, PlayMakersResponse, ResearchError } from '../lib/types'
import { PlayMakerCard } from './PlayMakerCard'

interface Props {
  /** Pre-fill the company context if a prospect has already been researched */
  defaultCompany?: string
}

export function PlayMakers({ defaultCompany }: Props) {
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [company, setCompany] = useState(defaultCompany ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playMakers, setPlayMakers] = useState<PlayMaker[]>([])
  const [researchingNames, setResearchingNames] = useState<string[]>([])

  function commitDraft() {
    // Split on comma OR newline so paste-from-anywhere works.
    const parts = draft
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    if (parts.length === 0) return
    setPending((prev) => uniq([...prev, ...parts]))
    setDraft('')
  }

  function removePending(name: string) {
    setPending((prev) => prev.filter((p) => p !== name))
  }

  function removeCard(id: string) {
    setPlayMakers((prev) => prev.filter((p) => p.id !== id))
  }

  async function run() {
    // Pull any uncommitted draft text into pending first.
    const commit = draft
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    const names = uniq([...pending, ...commit])
    if (names.length === 0) {
      setError('Add at least one name first.')
      return
    }
    setError(null)
    setLoading(true)
    setResearchingNames(names)
    setDraft('')
    setPending([])
    try {
      const res = await fetch('/api/playmakers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ names, company: company.trim() || undefined }),
      })
      const data = (await res.json()) as PlayMakersResponse | ResearchError
      if (!data.ok) {
        setError(data.error)
        return
      }
      setPlayMakers((prev) => [...data.playMakers, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setLoading(false)
      setResearchingNames([])
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="bg-black text-white p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
          <Users size={14} /> Meeting Prep — Play Makers
        </div>
        <h2 className="font-display text-3xl md:text-4xl mt-2 leading-tight">
          Who's in the room?
        </h2>
        <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
          Enter the names of the people you'll be meeting with on the prospect side.
          One per line, or paste a comma-separated list. We'll pull what they own,
          what they've said publicly, and where they overlap with LP Frontline — using
          Gemini (Google Search) plus Exa.ai for web evidence.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 items-start">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
              Names
            </label>
            <div className="bg-neutral-900 border border-neutral-700 p-2 min-h-[88px]">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {pending.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 bg-accent text-black text-xs font-semibold px-2 py-1"
                  >
                    {n}
                    <button
                      type="button"
                      onClick={() => removePending(n)}
                      className="hover:text-red-700"
                      aria-label={`Remove ${n}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    commitDraft()
                  } else if (e.key === ',' || e.key === 'Tab') {
                    if (draft.trim().length > 0) {
                      e.preventDefault()
                      commitDraft()
                    }
                  }
                }}
                onBlur={commitDraft}
                placeholder={
                  pending.length === 0
                    ? 'e.g. Roisin Currie, Mark Bourne\nor one name per line'
                    : 'Add another…'
                }
                className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none resize-none"
                rows={2}
              />
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Press <kbd className="bg-neutral-800 px-1">Enter</kbd> or{' '}
              <kbd className="bg-neutral-800 px-1">,</kbd> to add a name. Up to 10 per batch.
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
              Company (helps disambiguation)
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Greggs"
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500"
            />
            <button
              type="button"
              onClick={run}
              disabled={loading || (pending.length === 0 && draft.trim().length === 0)}
              className="mt-3 w-full px-4 py-2.5 bg-accent text-black text-sm font-semibold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Researching…
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Research {pending.length + (draft.trim() ? 1 : 0) || ''}{' '}
                  {pending.length + (draft.trim() ? 1 : 0) === 1 ? 'person' : 'people'}
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-300 inline-flex items-start gap-1.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading && researchingNames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {researchingNames.map((n) => (
            <div key={n} className="bg-white border border-neutral-200 p-5 animate-pulse">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 size={14} className="animate-spin" /> Researching {n}…
              </div>
              <div className="mt-3 h-3 bg-neutral-200 rounded w-2/3" />
              <div className="mt-2 h-3 bg-neutral-200 rounded w-1/2" />
              <div className="mt-2 h-3 bg-neutral-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {playMakers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playMakers.map((p) => (
            <PlayMakerCard key={p.id} playMaker={p} onRemove={() => removeCard(p.id)} />
          ))}
        </div>
      )}

      {!loading && playMakers.length === 0 && (
        <div className="border-2 border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          <Plus className="mx-auto mb-2" />
          <p className="text-sm">
            No play makers yet. Add the names of the people you're meeting and click{' '}
            <strong>Research</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}
