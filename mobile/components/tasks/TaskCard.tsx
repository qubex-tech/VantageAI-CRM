import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO, isPast, isToday } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TaskStatusColors, TaskPriorityColors, Colors } from '@/constants/colors'
import type { Task } from '@/types'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter()
  const statusColor = TaskStatusColors[task.status] ?? { bg: Colors.gray100, text: Colors.gray600 }
  const priorityColor = TaskPriorityColors[task.priority] ?? { bg: Colors.gray100, text: Colors.gray600 }

  const isOverdue =
    task.dueDate &&
    task.status !== 'completed' &&
    task.status !== 'cancelled' &&
    isPast(parseISO(task.dueDate)) &&
    !isToday(parseISO(task.dueDate))

  return (
    <TouchableOpacity
      onPress={() => router.push(`/tasks/${task.id}`)}
      activeOpacity={0.7}
    >
      <Card style={{ marginHorizontal: 16, marginVertical: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* Priority indicator */}
          <View
            style={{
              width: 4,
              borderRadius: 2,
              backgroundColor: priorityColor.text,
              alignSelf: 'stretch',
              minHeight: 40,
            }}
          />

          {/* Content */}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{ fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1 }}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              <Badge label={task.status} bg={statusColor.bg} color={statusColor.text} size="sm" />
            </View>

            {task.patient && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
                <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{task.patient.name}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              {task.dueDate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={isOverdue ? Colors.danger : Colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: isOverdue ? Colors.danger : Colors.textSecondary,
                      fontWeight: isOverdue ? '600' : '400',
                    }}
                  >
                    {isOverdue ? 'Overdue · ' : ''}
                    {format(parseISO(task.dueDate), 'MMM d')}
                  </Text>
                </View>
              ) : (
                <View />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge label={task.priority} bg={priorityColor.bg} color={priorityColor.text} size="sm" />
                {task._count && task._count.comments > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Ionicons name="chatbubble-outline" size={11} color={Colors.textMuted} />
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>{task._count.comments}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
        </View>
      </Card>
    </TouchableOpacity>
  )
}
