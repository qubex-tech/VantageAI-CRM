import { create } from 'zustand'
import type { ConversationStatus, Channel } from '@/types'

type StatusFilter = 'all' | ConversationStatus
type ChannelFilter = 'all' | Channel

interface InboxFilters {
  status: StatusFilter
  channel: ChannelFilter
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
  status: 'all',
  channel: 'all',
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
