import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchNotifications } from '@/services/notifications'

export interface UseNotificationsOptions {
  unreadOnly?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { unreadOnly = false } = options

  return useInfiniteQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: ({ pageParam }) =>
      fetchNotifications({ limit: 30, cursor: pageParam, unreadOnly }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 20_000,
    refetchInterval: 20_000,
  })
}
