import { apiGet, apiPost } from './apiClient'
import { ENDPOINTS } from '@/constants/api'
import type {
  Conversation,
  Message,
  ConversationsResponse,
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

interface ConversationDetailResponse {
  data?: { conversation?: Conversation }
  conversation?: Conversation
}

interface MessagesListResponse {
  data?: { messages?: Message[] }
  messages?: Message[]
}

function extractConversations(data: ConversationsResponse | Conversation[]): Conversation[] {
  if (Array.isArray(data)) return data
  return data.conversations ?? []
}

function extractConversation(data: ConversationDetailResponse | Conversation): Conversation {
  if ('patient' in data || ('id' in data && !('conversation' in data) && !('data' in data))) {
    return data as Conversation
  }
  const wrapped = data as ConversationDetailResponse
  return wrapped.data?.conversation ?? wrapped.conversation ?? (data as Conversation)
}

function extractMessages(data: MessagesListResponse | Message[]): Message[] {
  if (Array.isArray(data)) return data
  return data.data?.messages ?? data.messages ?? []
}

export async function fetchConversations(filters: ConversationFilters = {}): Promise<Conversation[]> {
  const params: Record<string, unknown> = {}
  if (filters.status) params.status = filters.status
  if (filters.channel) params.channel = filters.channel
  if (filters.assignee) params.assignee = filters.assignee
  if (filters.search) params.search = filters.search
  if (filters.limit) params.limit = filters.limit

  const data = await apiGet<ConversationsResponse | Conversation[]>(ENDPOINTS.conversations, params)
  return extractConversations(data)
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const data = await apiGet<ConversationDetailResponse | Conversation>(ENDPOINTS.conversationById(id))
  return extractConversation(data)
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const data = await apiGet<MessagesListResponse | Message[]>(ENDPOINTS.conversationMessages(conversationId))
  return extractMessages(data)
}

export async function sendMessage(payload: SendMessagePayload): Promise<Message> {
  return apiPost<Message>(ENDPOINTS.sendMessage, payload)
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiGet<{ count: number }>(ENDPOINTS.unreadCount)
  return data.count ?? 0
}
