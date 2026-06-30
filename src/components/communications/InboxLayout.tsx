"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './Sidebar'
import { ConversationList } from './ConversationList'
import { ConversationDetail } from './ConversationDetail'
import type { Conversation, ConversationView, Message } from './types'
import { setHealixContextOverride, setHealixPanelOpen } from '@/components/healix/HealixButton'
import { ArrowLeft, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        patientId: item.patient?.id ?? null,
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
      if (!selectedId && shaped.length > 0) {
        setSelectedId(shaped[0].id)
      }
    } catch {
      // Keep previous list if fetch fails to avoid empty flashes.
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
        patientId: conversation.patient?.id ?? null,
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('conversation-summary-refresh', {
            detail: { conversationId },
          })
        )
        window.dispatchEvent(
          new CustomEvent('draft-reply-refresh', {
            detail: { conversationId },
          })
        )
      }
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
    lastUnreadCountRef.current = unreadCount
  }, [unreadCount])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('inboxUnreadCount', String(unreadCount))
    window.dispatchEvent(new CustomEvent('inbox-unread-updated', { detail: { source: 'inbox' } }))
  }, [unreadCount])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUnreadUpdate = (event: Event) => {
      const customEvent = event as CustomEvent | null
      const source = customEvent?.detail?.source
      if (source === 'inbox') return
      const raw = window.localStorage.getItem('inboxUnreadCount')
      const nextUnread = raw ? Number(raw) : 0
      if (!Number.isFinite(nextUnread)) return
      if (nextUnread !== lastUnreadCountRef.current) {
        lastUnreadCountRef.current = nextUnread
        loadConversations()
        if (selectedId) {
          loadConversationDetail(selectedId)
        }
      }
    }

    window.addEventListener('inbox-unread-updated', handleUnreadUpdate)
    return () => window.removeEventListener('inbox-unread-updated', handleUnreadUpdate)
  }, [loadConversations, loadConversationDetail, selectedId])

  useEffect(() => {
    setLimit(30)
  }, [view])

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await fetchJson(`/api/conversations/${conversationId}/read`, {
        method: 'POST',
      })
    } catch {
      // Best effort; keep UI state responsive.
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadConversationDetail(selectedId)
    }
  }, [selectedId, loadConversationDetail])

  useEffect(() => {
    if (!selectedId) return
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedId ? { ...conversation, unread: false } : conversation
      )
    )
    markConversationRead(selectedId)
  }, [selectedId, markConversationRead])

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

  useEffect(() => {
    setHealixPanelOpen(true)
    return () => {
      setHealixPanelOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedConversation?.id) {
      setHealixContextOverride(null)
      return
    }
    setHealixContextOverride({
      route: `/communications/${selectedConversation.id}`,
      screenTitle: 'Communications / Inbox',
      patientId: selectedConversation.patientId ?? undefined,
      conversationId: selectedConversation.id,
      visibleFields: {
        patientName: selectedConversation.patientName,
        patientEmail: selectedConversation.patientEmail,
        patientPhone: selectedConversation.patientPhone,
      },
    })
    return () => {
      setHealixContextOverride(null)
    }
  }, [selectedConversation])

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

  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const handleMobileSelectConversation = (conversationId: string) => {
    setSelectedId(conversationId)
    setMobileView('detail')
  }

  const handleMobileBack = () => {
    setMobileView('list')
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-7.5rem)] md:h-[calc(100vh-4.5rem)] w-full overflow-hidden md:rounded-xl md:border md:border-slate-200 bg-white">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        {mobileView === 'detail' && selectedConversation ? (
          <>
            <button
              onClick={handleMobileBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {selectedConversation.patientName}
              </span>
            </div>
            <div className="w-16" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">Inbox</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                showMobileFilters ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter className="h-4 w-4" />
              {view}
            </button>
          </>
        )}
      </div>

      {/* Mobile Filters Dropdown */}
      {showMobileFilters && mobileView === 'list' && (
        <div className="md:hidden bg-slate-50 border-b border-slate-200 px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {(['Open', 'Pending', 'Resolved', 'Mine', 'Team'] as ConversationView[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v)
                  setShowMobileFilters(false)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  view === v
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar activeView={view} onChangeView={setView} unreadCount={unreadCount} />
      </div>

      {/* Conversation List - Hidden on mobile when viewing detail */}
      <div className={cn(
        "flex-1 md:flex-none md:w-[300px]",
        mobileView === 'detail' ? "hidden md:flex" : "flex"
      )}>
        <ConversationList
          conversations={conversations}
          loading={loadingConversations}
          selectedId={selectedId}
          onSelect={handleMobileSelectConversation}
          onLoadMore={() => setLimit((prev) => prev + 30)}
          loadingMore={loadingMore}
          onNewConversation={() => {
            setSelectedId(null)
            setSelectedConversation(null)
            setMessages([])
            setMobileView('detail')
          }}
        />
      </div>

      {/* Conversation Detail - Shown on mobile only when viewing detail */}
      <div className={cn(
        "flex-1",
        mobileView === 'list' ? "hidden md:flex" : "flex"
      )}>
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
    </div>
  )
}
