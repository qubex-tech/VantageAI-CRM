import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import type { ProspectResearch, ResearchError, ResearchResponse } from '../lib/types'

interface Props {
  onResult: (r: ProspectResearch) => void
}

export function ProspectSearch({ onResult }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prospectName: name.trim() }),
      })
      const data = (await res.json()) as ResearchResponse | ResearchError
      if (!data.ok) {
        setError(data.error)
        return
      }
      onResult(data.research)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={run} className="bg-black text-white p-5">
      <div className="text-xs uppercase tracking-widest text-accent mb-2">Prospect Research</div>
      <h2 className="font-display text-2xl leading-tight mb-3">Build a business case in 30 seconds.</h2>
      <p className="text-xs text-neutral-400 mb-4">
        Enter a company name. Gemini will research workforce size, turnover, compliance pressure
        and recent strategic moves — and pre-fill the calculator.
      </p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Greggs, Pret A Manger, Costa Coffee"
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-2 bg-accent text-black text-sm font-semibold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Researching…' : 'Research'}
        </button>
      </div>
      {error && (
        <div className="mt-3 text-xs text-red-300 inline-flex items-start gap-1.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}
