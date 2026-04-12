import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchConversations,
  fetchConversation,
  fetchMessages,
  sendMessage,
  fetchUnreadCount,
  type ConversationFilters,
} from '@/services/conversations'
import type { SendMessagePayload } from '@/types'

export const QUERY_KEYS = {
  conversations: (filters: ConversationFilters) => ['conversations', filters] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  unreadCount: ['unreadCount'] as const,
}

export function useConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.conversations(filters),
    queryFn: () => fetchConversations(filters),
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.conversation(id),
    queryFn: () => fetchConversation(id),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.messages(conversationId),
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 5_000,
    refetchInterval: 8_000, // poll every 8s for near-real-time inbound messages
    refetchIntervalInBackground: false,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: QUERY_KEYS.unreadCount,
    queryFn: fetchUnreadCount,
    staleTime: 20_000,
    refetchInterval: 20_000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SendMessagePayload) => sendMessage(payload),
    onSuccess: (_, vars) => {
      // Invalidate messages for this conversation
      if (vars.conversationId) {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.messages(vars.conversationId) })
        qc.invalidateQueries({ queryKey: QUERY_KEYS.conversation(vars.conversationId) })
      }
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount })
    },
  })
}
