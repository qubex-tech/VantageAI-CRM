import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCreateTask } from '@/hooks/useTasks'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Colors, TaskPriorityColors } from '@/constants/colors'
import type { TaskPriority } from '@/types'

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function NewTaskScreen() {
  const router = useRouter()
  const createTask = useCreateTask()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [titleError, setTitleError] = useState('')

  async function handleCreate() {
    if (!title.trim()) {
      setTitleError('Title is required')
      return
    }
    setTitleError('')
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status: 'pending',
      })
      router.back()
    } catch {
      Alert.alert('Error', 'Could not create task. Please try again.')
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New Task',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <Card style={{ gap: 14 }}>
            <Input
              label="Title *"
              placeholder="What needs to be done?"
              value={title}
              onChangeText={setTitle}
              error={titleError}
              autoFocus
            />

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.gray700 }}>
                Description
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 8,
                  padding: 10,
                  minHeight: 80,
                }}
              >
                <Input
                  placeholder="Optional details…"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={{ minHeight: 60, paddingVertical: 0 }}
                />
              </View>
            </View>

            {/* Priority selector */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.gray700 }}>Priority</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORITIES.map((p) => {
                  const c = TaskPriorityColors[p.value]
                  const selected = priority === p.value
                  return (
                    <TouchableOpacity
                      key={p.value}
                      onPress={() => setPriority(p.value)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: selected ? c.text : Colors.border,
                        backgroundColor: selected ? c.bg : Colors.white,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: selected ? c.text : Colors.textSecondary,
                          textTransform: 'capitalize',
                        }}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </Card>

          <Button
            title="Create Task"
            onPress={handleCreate}
            loading={createTask.isPending}
            size="lg"
          />
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
