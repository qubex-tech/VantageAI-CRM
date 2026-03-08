import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientsApi } from '@/lib/api'
import type { Patient, PatientNote } from '@/types'

export function usePatients(search?: string) {
  return useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const { data } = await patientsApi.list({ search, limit: 100 })
      return data.patients as Patient[]
    },
  })
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      const { data } = await patientsApi.get(id)
      return data.patient as Patient
    },
    enabled: !!id,
  })
}

export function usePatientTimeline(id: string) {
  return useQuery({
    queryKey: ['patients', id, 'timeline'],
    queryFn: async () => {
      const { data } = await patientsApi.timeline(id)
      return data.entries as unknown[]
    },
    enabled: !!id,
  })
}

export function usePatientNotes(id: string) {
  return useQuery({
    queryKey: ['patients', id, 'notes'],
    queryFn: async () => {
      const { data } = await patientsApi.notes(id)
      return data.notes as PatientNote[]
    },
    enabled: !!id,
  })
}

export function useAddPatientNote(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => patientsApi.addNote(patientId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients', patientId, 'notes'] })
      qc.invalidateQueries({ queryKey: ['patients', patientId, 'timeline'] })
    },
  })
}
