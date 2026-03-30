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

  // Normalize — web API returns conversations array directly
  const raw = Array.isArray(data) ? data : (data as any).conversations ?? []
  return raw as Conversation[]
}

export async function fetchConversation(id: string): Promise<Conversation> {
  return apiGet<Conversation>(ENDPOINTS.conversationById(id))
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const data = await apiGet<MessagesResponse | Message[]>(
    ENDPOINTS.conversationMessages(conversationId)
  )
  return Array.isArray(data) ? data : (data as MessagesResponse).messages ?? []
}

export async function sendMessage(payload: SendMessagePayload): Promise<Message> {
  return apiPost<Message>(ENDPOINTS.sendMessage, payload)
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiGet<{ count: number }>(ENDPOINTS.unreadCount)
  return data.count ?? 0
}
