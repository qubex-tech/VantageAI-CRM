import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { fetchNotifications } from '@/services/notifications'

export function useNotifications(unreadOnly = false) {
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
