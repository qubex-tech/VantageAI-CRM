"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface Article {
  id: string
  title: string
  url?: string | null
  tags: string[]
  updatedAt: string
  summary?: string | null
  lastSummarizedAt?: string | null
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return res.json()
}

export default function KnowledgeBasePage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadArticles = async () => {
    try {
      const data = await fetchJson<{ data: { articles: Article[] } }>('/api/knowledge-base')
      setArticles(data.data.articles)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadArticles()
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and content are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await fetchJson('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          url,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      })
      setTitle('')
      setBody('')
      setUrl('')
      setTags('')
      await loadArticles()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to save article.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
        <p className="mt-2 text-sm text-slate-500">
          Add clinic-approved information that Healix can use for drafts and summaries.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <Input
            placeholder="Article title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            placeholder="Optional link (https://...)"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Input
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <Textarea
            placeholder="Paste clinic-approved content here..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[160px]"
          />
          {error ? <div className="text-sm text-rose-500">{error}</div> : null}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving…' : 'Save article'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-700">Recent articles</div>
        <div className="space-y-2">
          {articles.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No knowledge base entries yet.
            </div>
          )}
          {articles.map((article) => (
            <div key={article.id} className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">{article.title}</div>
              {article.summary && (
                <div className="mt-2 text-xs text-slate-600">
                  {article.summary}
                </div>
              )}
              {article.url && (
                <a href={article.url} className="text-xs text-slate-500 hover:text-slate-700">
                  {article.url}
                </a>
              )}
              {article.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-400">
                Updated {new Date(article.updatedAt).toLocaleDateString()}
                {article.lastSummarizedAt
                  ? ` · Summarized ${new Date(article.lastSummarizedAt).toLocaleDateString()}`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
