"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageTimeline } from './MessageTimeline'
import { Composer } from './Composer'
import { NewMessagePanel } from './NewMessagePanel'
import { ConversationSummary } from './ConversationSummary'
import { Button } from '@/components/ui/button'
import type { Conversation, ConversationSummaryData, Message } from './types'

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return res.json()
}

export function ConversationDetail({
  conversation,
  messages,
  loading,
  onSendMessage,
  onAssignClick,
  onStartConversation,
  sending,
}: {
  conversation: Conversation | null
  messages: Message[]
  loading: boolean
  onSendMessage: (payload: { body: string; channel: string; subject?: string }) => Promise<boolean>
  onAssignClick: () => void
  onStartConversation: (payload: { patientId: string; channel: string; body: string; subject?: string }) => Promise<void>
  sending: boolean
}) {
  const [summary, setSummary] = useState<ConversationSummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  const loadSummary = useCallback(async (conversationId: string) => {
    try {
      const data = await fetchJson<{ data: { summary: ConversationSummaryData | null; needsReview: boolean } }>(
        `/api/conversations/${conversationId}/summary`
      )
      const summaryData = data.data.summary
      if (!summaryData) {
        setSummary(null)
        return false
      }
      setSummary({
        ...summaryData,
        needsReview: data.data.needsReview,
      })
      return true
    } catch {
      setSummaryError(true)
      return false
    }
  }, [])

  const refreshSummary = useCallback(
    async (conversationId: string) => {
      setSummaryLoading(true)
      setSummaryError(false)
      try {
        const data = await fetchJson<{
          data: { summary: ConversationSummaryData | null; needsReview: boolean }
        }>(`/api/conversations/${conversationId}/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageLimit: 20 }),
        })
        if (data.data.summary) {
          setSummary({ ...data.data.summary, needsReview: data.data.needsReview })
        }
      } catch {
        setSummaryError(true)
      } finally {
        setSummaryLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!conversation?.id) return
    setSummary(null)
    setSummaryError(false)
    lastMessageIdRef.current = null
    loadSummary(conversation.id).then((hasSummary) => {
      if (!hasSummary) {
        refreshSummary(conversation.id)
      }
    })
  }, [conversation?.id, loadSummary, refreshSummary])

  useEffect(() => {
    if (!conversation?.id) return
    const latestMessageId = messages[messages.length - 1]?.id ?? null
    if (!latestMessageId || latestMessageId === lastMessageIdRef.current) return
    lastMessageIdRef.current = latestMessageId

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      refreshSummary(conversation.id)
    }, 1500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [conversation?.id, messages, refreshSummary])

  if (!conversation && !loading) {
    return (
      <section className="flex flex-1 items-center justify-center px-6 py-8">
        <NewMessagePanel onStart={onStartConversation} loading={sending} />
      </section>
    )
  }

  return (
    <section className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 px-8 py-5">
        {loading || !conversation ? (
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {conversation.patientName}
              </div>
              <div className="text-xs text-slate-500">
                {conversation.status} · {conversation.channel.toUpperCase()}
              </div>
              {(conversation.patientEmail || conversation.patientPhone) && (
                <div className="mt-1 text-xs text-slate-400">
                  {conversation.patientEmail || 'No email'} · {conversation.patientPhone || 'No phone'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onAssignClick}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                {conversation.assignee ? `Assigned to ${conversation.assignee}` : 'Assign'}
              </button>
              <Button size="sm">Resolve</Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4">
          <ConversationSummary
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            onRefresh={() => {
              if (conversation?.id) {
                refreshSummary(conversation.id)
              }
            }}
          />
        </div>
        <MessageTimeline messages={messages} loading={loading} />
      </div>

      <div className="border-t border-slate-200 px-8 py-4">
        <Composer onSend={onSendMessage} disabled={sending} defaultChannel={conversation?.channel} />
      </div>
    </section>
  )
}
