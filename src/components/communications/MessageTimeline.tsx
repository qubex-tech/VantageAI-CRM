"use client"

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from './types'

export function MessageTimeline({
  messages,
  loading,
}: {
  messages: Message[]
  loading: boolean
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
            <div className="h-12 w-full rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No messages yet. Start with a friendly reply.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
