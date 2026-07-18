import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import {
  fetchAriaSchedule,
  fetchAriaSession,
  fetchAriaSessions,
  fetchMobileFeatures,
} from '@/services/aria'
import { useAuthStore } from '@/store/authStore'

export function useAriaEnabled() {
  const { user, token, setAriaScribeEnabled } = useAuthStore()
  const query = useQuery({
    queryKey: ['mobile-features', user?.practiceId],
    queryFn: fetchMobileFeatures,
    enabled: Boolean(token),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (typeof query.data?.ariaScribeEnabled === 'boolean') {
      setAriaScribeEnabled(query.data.ariaScribeEnabled)
    }
  }, [query.data?.ariaScribeEnabled, setAriaScribeEnabled])

  const enabled =
    query.data?.ariaScribeEnabled ?? user?.ariaScribeEnabled ?? false

  return { enabled, ...query }
}

export function useAriaSchedule(date?: string) {
  return useQuery({
    queryKey: ['aria-schedule', date ?? 'today'],
    queryFn: () => fetchAriaSchedule(date),
    refetchInterval: 60_000,
  })
}

export function useAriaSessions() {
  return useQuery({
    queryKey: ['aria-sessions'],
    queryFn: () => fetchAriaSessions(),
    refetchInterval: 20_000,
  })
}

export function useAriaSession(sessionId: string | undefined, opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['aria-session', sessionId],
    queryFn: () => fetchAriaSession(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: (q) => {
      if (!opts?.poll) return false
      const status = q.state.data?.session.status
      if (!status) return 3000
      if (['uploading', 'transcribing', 'generating', 'recording'].includes(status)) {
        return 2500
      }
      return false
    },
  })
}

export function useInvalidateAria() {
  const qc = useQueryClient()
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['aria-schedule'] })
    void qc.invalidateQueries({ queryKey: ['aria-sessions'] })
    void qc.invalidateQueries({ queryKey: ['aria-session'] })
  }, [qc])
}
