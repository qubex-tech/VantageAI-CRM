import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentsApi } from '@/lib/api'
import type { Appointment } from '@/types'

export function useAppointments(params?: { status?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: async () => {
      const { data } = await appointmentsApi.list({ ...params, limit: 100 })
      return data.appointments as Appointment[]
    },
  })
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: async () => {
      const { data } = await appointmentsApi.get(id)
      return data.appointment as Appointment
    },
    enabled: !!id,
  })
}

export function useUpdateAppointment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => appointmentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
