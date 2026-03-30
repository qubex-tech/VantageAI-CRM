import { create } from 'zustand'
import type { ConversationStatus, Channel } from '@/types'

interface InboxFilters {
  status: ConversationStatus | undefined
  channel: Channel | undefined
  assignee: 'me' | 'team' | 'all'
  search: string
}

interface InboxStore {
  filters: InboxFilters
  unreadCount: number

  setFilter: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void
  resetFilters: () => void
  setUnreadCount: (count: number) => void
}

const defaultFilters: InboxFilters = {
  status: 'open',
  channel: undefined,
  assignee: 'all',
  search: '',
}

export const useInboxStore = create<InboxStore>((set) => ({
  filters: { ...defaultFilters },
  unreadCount: 0,

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  setUnreadCount: (count) => set({ unreadCount: count }),
}))
