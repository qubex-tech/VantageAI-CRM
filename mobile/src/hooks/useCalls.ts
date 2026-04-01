import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCalls, fetchCall, markCallReviewed } from '@/services/calls'

export function useCalls(filter = {}) {
  return useQuery({
    queryKey: ['calls', filter],
    queryFn: () => fetchCalls(filter),
    refetchInterval: 60_000,
  })
}

export function useCall(id: string) {
  return useQuery({
    queryKey: ['call', id],
    queryFn: () => fetchCall(id),
    enabled: !!id,
  })
}

export function useMarkCallReviewed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markCallReviewed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calls'] }),
  })
}
