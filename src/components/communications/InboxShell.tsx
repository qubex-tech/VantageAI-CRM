"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { InboxSidebar } from './InboxSidebar'
import { ConversationList } from './ConversationList'
import { ConversationDetail } from './ConversationDetail'
import type { AttachmentDraft } from './Composer'
import type { CommunicationChannel, ConversationStatus } from '@/lib/communications/types'

type AssigneeFilter = 'me' | 'team' | 'all'

export interface ConversationListItem {
  id: string
  status: ConversationStatus
  channel: CommunicationChannel
  subject?: string | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  updatedAt: string
  patient: {
    id: string
    name: string
  }
  assignee: { type: 'user' | 'team'; id: string; name: string } | null
  unread: boolean
}

export interface ConversationDetailData {
  id: string
  status: ConversationStatus
  channel: CommunicationChannel
  subject?: string | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  patient: {
    id: string
    name: string
    primaryPhone?: string | null
    email?: string | null
  }
  assignee: { type: 'user' | 'team'; id: string; name: string } | null
}

export interface MessageItem {
  id: string
  body: string
  type: 'message' | 'note' | 'system'
  direction: 'inbound' | 'outbound' | 'internal'
  channel: CommunicationChannel
  deliveryStatus: string
  createdAt: string
  readAt?: string | null
  intent?: string | null
  intentConfidence?: number | null
  author?: { id: string; name: string } | null
  attachments?: Array<{
    id: string
    fileName: string
    mimeType?: string | null
    fileSize?: number | null
    url?: string | null
  }>
}

const defaultFilters = {
  status: 'open' as ConversationStatus,
  assignee: 'all' as AssigneeFilter,
  channel: 'all' as CommunicationChannel | 'all',
  search: '',
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return res.json()
}

export function InboxShell({ initialConversationId }: { initialConversationId?: string }) {
  const [filters, setFilters] = useState(defaultFilters)
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId || null)
  const [conversationDetail, setConversationDetail] = useState<ConversationDetailData | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1
    return conversations.findIndex((conversation) => conversation.id === selectedId)
  }, [conversations, selectedId])

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.assignee) params.set('assignee', filters.assignee)
    if (filters.channel && filters.channel !== 'all') params.set('channel', filters.channel)
    if (filters.search) params.set('search', filters.search)

    try {
      const data = await fetchJson<{ data: { conversations: ConversationListItem[] } }>(
        `/api/conversations?${params.toString()}`
      )
      const list = data.data?.conversations ?? []
      setConversations(list)
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id)
      }
    } catch (error) {
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }, [filters, selectedId])

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    setLoadingDetail(true)
    try {
      const [detail, messagesResponse] = await Promise.all([
        fetchJson<{ data: { conversation: ConversationDetailData } }>(`/api/conversations/${conversationId}`),
        fetchJson<{ data: { messages: MessageItem[] } }>(`/api/conversations/${conversationId}/messages`),
      ])
      setConversationDetail(detail.data.conversation)
      setMessages(messagesResponse.data.messages)
    } catch (error) {
      setConversationDetail(null)
      setMessages([])
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

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
        setConversationDetail(null)
        setMessages([])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [conversations, selectedIndex])

  const updateConversationPreview = useCallback((conversationId: string, body: string) => {
    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: body.slice(0, 140),
            }
          : item
      )
    )
  }, [])

  const handleSendMessage = useCallback(
    async (body: string, attachments: AttachmentDraft[]) => {
      if (!selectedId) return
      const tempId = `temp-${Date.now()}`
      const optimistic: MessageItem = {
        id: tempId,
        body,
        type: 'message',
        direction: 'outbound',
        channel: conversationDetail?.channel || 'secure',
        deliveryStatus: 'queued',
        createdAt: new Date().toISOString(),
        attachments,
      }
      setMessages((prev) => [...prev, optimistic])
      updateConversationPreview(selectedId, body)
      setSending(true)

      try {
        await fetchJson(`/api/messages/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedId,
            body,
            attachments: attachments?.map((file) => ({
              fileName: file.fileName,
              mimeType: file.mimeType,
              fileSize: file.fileSize,
              storageKey: file.storageKey,
              url: file.url,
            })),
          }),
        })
        await loadConversationDetail(selectedId)
      } catch (error) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId))
      } finally {
        setSending(false)
      }
    },
    [selectedId, conversationDetail, loadConversationDetail, updateConversationPreview]
  )

  const handleAddNote = useCallback(
    async (body: string) => {
      if (!selectedId) return
      setSending(true)
      try {
        await fetchJson(`/api/conversations/${selectedId}/note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        updateConversationPreview(selectedId, body)
        await loadConversationDetail(selectedId)
      } finally {
        setSending(false)
      }
    },
    [selectedId, loadConversationDetail, updateConversationPreview]
  )

  const handleAssign = useCallback(
    async (assigneeType: 'user' | 'team', assigneeId: string) => {
      if (!selectedId) return
      await fetchJson(`/api/conversations/${selectedId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeType, assigneeId }),
      })
      await loadConversationDetail(selectedId)
      await loadConversations()
    },
    [selectedId, loadConversationDetail, loadConversations]
  )

  const handleResolve = useCallback(async () => {
    if (!selectedId) return
    await fetchJson(`/api/conversations/${selectedId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    })
    await loadConversationDetail(selectedId)
    await loadConversations()
  }, [selectedId, loadConversationDetail, loadConversations])

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <InboxSidebar filters={filters} onChange={setFilters} />
      <ConversationList
        conversations={conversations}
        loading={loadingConversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ConversationDetail
        conversation={conversationDetail}
        loading={loadingDetail}
        messages={messages}
        onSendMessage={handleSendMessage}
        onAddNote={handleAddNote}
        onAssign={handleAssign}
        onResolve={handleResolve}
        sending={sending}
      />
    </div>
  )
}
