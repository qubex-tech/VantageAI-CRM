import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { useTask, useTaskComments, useUpdateTask, useAddTaskComment } from '@/hooks/useTasks'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { TaskStatusColors, TaskPriorityColors, Colors } from '@/constants/colors'
import type { TaskStatus } from '@/types'

const STATUS_TRANSITIONS: Record<TaskStatus, { label: string; next: TaskStatus }[]> = {
  pending: [
    { label: 'Start', next: 'in_progress' },
    { label: 'Cancel', next: 'cancelled' },
  ],
  in_progress: [
    { label: 'Complete', next: 'completed' },
    { label: 'Put on Hold', next: 'on_hold' },
  ],
  on_hold: [{ label: 'Resume', next: 'in_progress' }],
  completed: [],
  cancelled: [],
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [commentText, setCommentText] = useState('')

  const { data: task, isLoading } = useTask(id)
  const { data: comments } = useTaskComments(id)
  const updateTask = useUpdateTask(id)
  const addComment = useAddTaskComment(id)

  async function handleStatusChange(next: TaskStatus) {
    try {
      await updateTask.mutateAsync({ status: next })
    } catch {
      Alert.alert('Error', 'Could not update task status.')
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return
    try {
      await addComment.mutateAsync(commentText.trim())
      setCommentText('')
    } catch {
      Alert.alert('Error', 'Could not save comment.')
    }
  }

  if (isLoading || !task) {
    return <LoadingSpinner fullScreen message="Loading task…" />
  }

  const statusColor = TaskStatusColors[task.status] ?? { bg: Colors.gray100, text: Colors.gray600 }
  const priorityColor = TaskPriorityColors[task.priority] ?? { bg: Colors.gray100, text: Colors.gray600 }
  const transitions = STATUS_TRANSITIONS[task.status] ?? []

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Task',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {/* Header */}
          <Card>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 }}>
              {task.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Badge label={task.status} bg={statusColor.bg} color={statusColor.text} />
              <Badge label={task.priority} bg={priorityColor.bg} color={priorityColor.text} />
            </View>

            {task.description && (
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.textSecondary,
                  lineHeight: 20,
                  marginTop: 12,
                  padding: 10,
                  backgroundColor: Colors.gray50,
                  borderRadius: 8,
                }}
              >
                {task.description}
              </Text>
            )}
          </Card>

          {/* Meta */}
          <Card style={{ gap: 0 }}>
            {task.patient && (
              <TouchableOpacity
                onPress={() => router.push(`/patients/${task.patient!.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.gray100,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Patient</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.primary }}>
                    {task.patient.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            )}

            {task.dueDate && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.gray100,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.textSecondary} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Due Date</Text>
                </View>
                <Text style={{ fontSize: 14, color: Colors.text }}>
                  {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                </Text>
              </View>
            )}

            {task.assignee && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="person-circle-outline" size={15} color={Colors.textSecondary} />
                  <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Assigned to</Text>
                </View>
                <Text style={{ fontSize: 14, color: Colors.text }}>{task.assignee.name}</Text>
              </View>
            )}
          </Card>

          {/* Status actions */}
          {transitions.length > 0 && (
            <View style={{ gap: 8 }}>
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  title={t.label}
                  variant={t.next === 'completed' ? 'primary' : t.next === 'cancelled' ? 'danger' : 'outline'}
                  onPress={() => handleStatusChange(t.next)}
                  loading={updateTask.isPending}
                />
              ))}
            </View>
          )}

          {/* Comments */}
          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 4 }}>
            Comments {comments ? `(${comments.length})` : ''}
          </Text>

          {/* Add comment */}
          <Card>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 8,
                padding: 10,
                fontSize: 14,
                color: Colors.text,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
              multiline
              placeholder="Add a comment…"
              placeholderTextColor={Colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={!commentText.trim() || addComment.isPending}
              style={{
                marginTop: 8,
                backgroundColor: !commentText.trim() ? Colors.gray200 : Colors.primary,
                borderRadius: 8,
                paddingVertical: 9,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: !commentText.trim() ? Colors.gray500 : Colors.white,
                }}
              >
                {addComment.isPending ? 'Posting…' : 'Post Comment'}
              </Text>
            </TouchableOpacity>
          </Card>

          {comments && comments.length > 0 ? (
            comments.map((c) => (
              <Card key={c.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: Colors.primaryBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>
                        {c.author?.name?.charAt(0) ?? '?'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>
                      {c.author?.name ?? 'Unknown'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    {format(parseISO(c.createdAt), 'MMM d, h:mm a')}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: Colors.textSecondary, lineHeight: 20 }}>
                  {c.content}
                </Text>
              </Card>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>No comments yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
