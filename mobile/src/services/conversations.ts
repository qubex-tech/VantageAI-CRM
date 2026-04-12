import { apiGet, apiPost } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type {
  Conversation,
  Message,
  ConversationsResponse,
  MessagesResponse,
  SendMessagePayload,
  Channel,
  ConversationStatus,
} from '@/types'

export interface ConversationFilters {
  status?: ConversationStatus
  channel?: Channel
  assignee?: 'me' | 'team' | 'all'
  search?: string
  limit?: number
}

export async function fetchConversations(filters: ConversationFilters = {}): Promise<Conversation[]> {
  const params: Record<string, unknown> = {}
  if (filters.status) params.status = filters.status
  if (filters.channel) params.channel = filters.channel
  if (filters.assignee) params.assignee = filters.assignee
  if (filters.search) params.search = filters.search
  if (filters.limit) params.limit = filters.limit

  const data = await apiGet<ConversationsResponse>(ENDPOINTS.conversations, params)

  // API returns { data: { conversations: [...] } } — extract the array
  const raw = Array.isArray(data)
    ? data
    : (data as any).data?.conversations
      ?? (data as any).conversations
      ?? []
  return raw as Conversation[]
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const data = await apiGet<any>(ENDPOINTS.conversationById(id))
  // API returns { data: { conversation: {...} } }
  return (data?.data?.conversation ?? data?.conversation ?? data) as Conversation
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const data = await apiGet<any>(ENDPOINTS.conversationMessages(conversationId))
  // API returns { data: { messages: [...] } }
  if (Array.isArray(data)) return data
  return data?.data?.messages ?? data?.messages ?? []
}

export async function sendMessage(payload: SendMessagePayload): Promise<Message> {
  return apiPost<Message>(ENDPOINTS.sendMessage, payload)
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiGet<{ count: number }>(ENDPOINTS.unreadCount)
  return data.count ?? 0
}
