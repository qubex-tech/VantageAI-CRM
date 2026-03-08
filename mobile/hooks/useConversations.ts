import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationsApi } from '@/lib/api'
import type { Conversation, Message } from '@/types'

export function useConversations(params?: { status?: string; channel?: string; search?: string }) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const { data } = await conversationsApi.list({ ...params, limit: 100 })
      return data.conversations as Conversation[]
    },
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: async () => {
      const { data } = await conversationsApi.get(id)
      return data.conversation as Conversation
    },
    enabled: !!id,
  })
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: async () => {
      const { data } = await conversationsApi.messages(conversationId)
      return data.messages as Message[]
    },
    enabled: !!conversationId,
    refetchInterval: 15000, // Poll every 15s
  })
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; channel: string }) =>
      conversationsApi.sendMessage(conversationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
