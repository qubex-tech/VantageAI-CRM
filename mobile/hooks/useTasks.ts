import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/lib/api'
import type { Task, TaskComment } from '@/types'

export function useTasks(params?: {
  assignedTo?: string
  status?: string
  priority?: string
  dueDate?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const { data } = await tasksApi.list({ ...params, limit: 100 })
      return data.tasks as Task[]
    },
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const { data } = await tasksApi.get(id)
      return data.task as Task
    },
    enabled: !!id,
  })
}

export function useTaskComments(id: string) {
  return useQuery({
    queryKey: ['tasks', id, 'comments'],
    queryFn: async () => {
      const { data } = await tasksApi.comments(id)
      return data.comments as TaskComment[]
    },
    enabled: !!id,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useAddTaskComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => tasksApi.addComment(taskId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] })
    },
  })
}
