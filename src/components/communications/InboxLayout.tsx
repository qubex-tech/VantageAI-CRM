"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './Sidebar'
import { ConversationList } from './ConversationList'
import { ConversationDetail } from './ConversationDetail'
import type { Conversation, ConversationView, Message } from './types'

const viewToFilters: Record<ConversationView, { status?: string; assignee?: string }> = {
  Open: { status: 'open' },
  Pending: { status: 'pending' },
  Resolved: { status: 'resolved' },
  Mine: { assignee: 'me' },
  Team: { assignee: 'team' },
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return res.json()
}

export function InboxLayout({ initialConversationId }: { initialConversationId?: string }) {
  const [view, setView] = useState<ConversationView>('Open')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [limit, setLimit] = useState(30)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const pendingMessageIds = useRef(new Set<string>())
  const lastNotifiedAtRef = useRef<string | null>(null)

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1
    return conversations.findIndex((conversation) => conversation.id === selectedId)
  }, [conversations, selectedId])

  const unreadCount = useMemo(
    () => conversations.filter((conversation) => conversation.unread).length,
    [conversations]
  )

  const lastUnreadCountRef = useRef(0)

  const loadConversations = useCallback(async () => {
    if (limit > 30) {
      setLoadingMore(true)
    } else {
      setLoadingConversations(true)
    }
    const params = new URLSearchParams()
    const filters = viewToFilters[view]
    if (filters.status) params.set('status', filters.status)
    if (filters.assignee) params.set('assignee', filters.assignee)
    params.set('limit', String(limit))

    try {
      const data = await fetchJson<{ data: { conversations: any[] } }>(
        `/api/conversations?${params.toString()}`
      )
      const items = data.data?.conversations ?? []
      const shaped = items.map((item) => ({
        id: item.id,
        patientName: item.patient?.name ?? 'Unknown',
        patientEmail: item.patient?.email ?? null,
        patientPhone: item.patient?.primaryPhone ?? null,
        lastMessageAt: item.lastMessageAt || item.updatedAt,
        lastMessageSnippet: item.lastMessagePreview ?? '',
        channel: item.channel,
        unread: Boolean(item.unread),
        updatedAt: item.lastMessageAt || item.updatedAt,
        status: item.status,
        assignee: item.assignee?.name ?? null,
      }))
      setConversations(shaped)
      const newestUnread = shaped.find((item) => item.unread && item.lastMessageAt)
      if (newestUnread?.lastMessageAt) {
        if (lastNotifiedAtRef.current !== newestUnread.lastMessageAt) {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`New message from ${newestUnread.patientName}`, {
              body: newestUnread.lastMessageSnippet || 'New message received',
            })
          }
          lastNotifiedAtRef.current = newestUnread.lastMessageAt
        }
      }
      if (!selectedId && shaped.length > 0) {
        setSelectedId(shaped[0].id)
      }
    } catch {
      setConversations([])
    } finally {
      setLoadingConversations(false)
      setLoadingMore(false)
    }
  }, [view, selectedId, limit])

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const [detail, messagesResponse] = await Promise.all([
        fetchJson<{ data: { conversation: any } }>(`/api/conversations/${conversationId}`),
        fetchJson<{ data: { messages: any[] } }>(`/api/conversations/${conversationId}/messages`),
      ])
      const conversation = detail.data.conversation
      setSelectedConversation({
        id: conversation.id,
        patientName: conversation.patient?.name ?? 'Unknown',
        patientEmail: conversation.patient?.email ?? null,
        patientPhone: conversation.patient?.primaryPhone ?? null,
        lastMessageSnippet: conversation.lastMessagePreview ?? '',
        channel: conversation.channel,
        unread: false,
        updatedAt: conversation.lastMessageAt || conversation.updatedAt,
        status: conversation.status,
        assignee: conversation.assignee?.name ?? null,
      })
      const shapedMessages = messagesResponse.data.messages.map((message) => {
        const senderType: Message['senderType'] =
          message.direction === 'outbound'
            ? 'staff'
            : message.direction === 'internal'
              ? 'system'
              : 'patient'
        return {
          id: message.id,
          senderType,
          body: message.body,
          createdAt: message.createdAt,
          isInternalNote: message.type === 'note' || message.direction === 'internal',
          channel: message.channel,
        }
      })
      setMessages(shapedMessages)
    } catch {
      setSelectedConversation(null)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => null)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    const nextUnread = unreadCount
    const prevUnread = lastUnreadCountRef.current
    if (nextUnread > prevUnread && Notification.permission === 'granted') {
      const newest = conversations.find((conversation) => conversation.unread)
      if (newest) {
        new Notification(`New message from ${newest.patientName}`, {
          body: newest.lastMessageSnippet || 'New message received',
        })
      }
    }
    lastUnreadCountRef.current = nextUnread
  }, [unreadCount, conversations])

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations()
    }, 15000)
    return () => clearInterval(interval)
  }, [loadConversations])

  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(() => {
      loadConversationDetail(selectedId)
    }, 8000)
    return () => clearInterval(interval)
  }, [selectedId, loadConversationDetail])

  useEffect(() => {
    setLimit(30)
  }, [view])

  useEffect(() => {
    if (selectedId) {
      loadConversationDetail(selectedId)
    }
  }, [selectedId, loadConversationDetail])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (isTyping) return

      if (event.key === 'j') {
        event.preventDefault()
        if (conversations.length === 0) return
        const nextIndex = Math.min(conversations.length - 1, selectedIndex + 1)
        setSelectedId(conversations[nextIndex].id)
      }
      if (event.key === 'k') {
        event.preventDefault()
        if (conversations.length === 0) return
        const nextIndex = Math.max(0, selectedIndex - 1)
        setSelectedId(conversations[nextIndex].id)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (selectedIndex >= 0 && conversations[selectedIndex]) {
          setSelectedId(conversations[selectedIndex].id)
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSelectedId(null)
        setSelectedConversation(null)
        setMessages([])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [conversations, selectedIndex])

  const handleSelectConversation = (conversationId: string) => {
    setSelectedId(conversationId)
  }

  const handleSendMessage = useCallback(
    async (payload: { body: string; channel: string; subject?: string }) => {
      if (!selectedId) return false
      const tempId = `temp-${Date.now()}`
      pendingMessageIds.current.add(tempId)
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          senderType: 'staff',
          body: payload.body,
          createdAt: new Date().toISOString(),
          isInternalNote: false,
          channel: payload.channel || selectedConversation?.channel || 'sms',
        },
      ])
      setSending(true)

      try {
        await fetchJson(`/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedId,
            body: payload.body,
            channel: payload.channel,
            subject: payload.subject,
          }),
        })
        await loadConversationDetail(selectedId)
        await loadConversations()
        return true
      } catch {
        setMessages((prev) => prev.filter((message) => message.id !== tempId))
        return false
      } finally {
        pendingMessageIds.current.delete(tempId)
        setSending(false)
      }
    },
    [selectedId, loadConversationDetail, loadConversations, selectedConversation]
  )

  const handleStartConversation = useCallback(
    async (payload: { patientId: string; channel: string; body: string; subject?: string }) => {
      setSending(true)
      try {
        const data = await fetchJson<{ data: { conversationId: string } }>(`/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const conversationId = data.data.conversationId
        setSelectedId(conversationId)
        await loadConversations()
        await loadConversationDetail(conversationId)
      } finally {
        setSending(false)
      }
    },
    [loadConversations, loadConversationDetail]
  )

  const handleAssignClick = useCallback(() => {
    // Placeholder for assignee selector; future hook into assignment UI.
  }, [])

  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Sidebar activeView={view} onChangeView={setView} unreadCount={unreadCount} />
      <ConversationList
        conversations={conversations}
        loading={loadingConversations}
        selectedId={selectedId}
        onSelect={handleSelectConversation}
        onLoadMore={() => setLimit((prev) => prev + 30)}
        loadingMore={loadingMore}
        onNewConversation={() => {
          setSelectedId(null)
          setSelectedConversation(null)
          setMessages([])
        }}
      />
      <ConversationDetail
        conversation={selectedConversation}
        messages={messages}
        loading={loadingMessages}
        onSendMessage={handleSendMessage}
        onAssignClick={handleAssignClick}
        onStartConversation={handleStartConversation}
        sending={sending}
      />
    </div>
  )
}
