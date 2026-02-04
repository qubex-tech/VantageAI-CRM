"use client"

import { useEffect, useRef } from 'react'
import { ConversationRow } from './ConversationRow'
import { EmptyState } from './EmptyState'
import type { Conversation } from './types'

export function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
  onLoadMore,
  loadingMore,
  onNewConversation,
}: {
  conversations: Conversation[]
  selectedId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onLoadMore: () => void
  loadingMore: boolean
  onNewConversation: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const lastLoadRef = useRef(0)

  useEffect(() => {
    if (loading) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          const now = Date.now()
          if (now - lastLoadRef.current < 1200) {
            return
          }
          lastLoadRef.current = now
          onLoadMore()
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loading, onLoadMore, conversations.length])

  return (
    <section className="flex h-full w-[360px] flex-col border-r border-slate-200">
      <div className="flex items-center justify-between px-6 py-4 text-sm font-medium text-slate-500">
        <span>Conversations</span>
        <button
          onClick={onNewConversation}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
        >
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-4 px-6 py-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="Inbox Zero"
            description="All clear. New messages will appear here."
          />
        ) : (
          <div className="space-y-1 px-3 pb-6">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={selectedId === conversation.id}
                onClick={() => onSelect(conversation.id)}
              />
            ))}
            <div ref={sentinelRef} className="h-6" />
            {loadingMore ? (
              <div className="px-3 py-3">
                <div className="h-px w-full bg-slate-100" />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
