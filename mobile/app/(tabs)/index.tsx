import React from 'react'
import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { appointmentsApi, tasksApi, conversationsApi, patientsApi } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { AppointmentCard } from '@/components/appointments/AppointmentCard'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Colors } from '@/constants/colors'
import type { Appointment, Task } from '@/types'

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  onPress,
}: {
  label: string
  value: number | string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  bg: string
  onPress?: () => void
}) {
  return (
    <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.75}>
      <Card padding={14}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.text }}>{value}</Text>
        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{label}</Text>
      </Card>
    </TouchableOpacity>
  )
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: todayAppts } = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: async () => {
      const { data } = await appointmentsApi.list({ from: today, to: today, limit: 5 })
      return data.appointments as Appointment[]
    },
  })

  const { data: pendingTasks } = useQuery({
    queryKey: ['tasks', 'pending', 'me'],
    queryFn: async () => {
      const { data } = await tasksApi.list({ assignedTo: 'me', status: 'pending', limit: 5 })
      return data.tasks as Task[]
    },
  })

  const { data: patients } = useQuery({
    queryKey: ['patients', 'count'],
    queryFn: async () => {
      const { data } = await patientsApi.list({ limit: 1 })
      return data.patients as unknown[]
    },
  })

  const { data: unread } = useQuery({
    queryKey: ['conversations', 'unread'],
    queryFn: async () => {
      const { data } = await conversationsApi.unreadCount()
      return (data.unreadCount ?? 0) as number
    },
    refetchInterval: 30000,
  })

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: Colors.white,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{greeting}</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.text }}>
              {user?.name?.split(' ')[0] ?? 'Doctor'} 👋
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>
              {format(new Date(), 'EEEE, MMMM d')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: Colors.gray100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.gray600} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>Overview</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="Patients"
              value={patients?.length ?? '—'}
              icon="people-outline"
              color={Colors.primary}
              bg={Colors.primaryBg}
              onPress={() => router.push('/(tabs)/patients')}
            />
            <StatCard
              label="Today"
              value={todayAppts?.length ?? '—'}
              icon="calendar-outline"
              color={Colors.success}
              bg={Colors.successBg}
              onPress={() => router.push('/(tabs)/appointments')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              label="My Tasks"
              value={pendingTasks?.length ?? '—'}
              icon="checkmark-circle-outline"
              color={Colors.warning}
              bg={Colors.warningBg}
              onPress={() => router.push('/(tabs)/tasks')}
            />
            <StatCard
              label="Unread"
              value={unread ?? '—'}
              icon="chatbubbles-outline"
              color={Colors.danger}
              bg={Colors.dangerBg}
              onPress={() => router.push('/(tabs)/inbox')}
            />
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
              Today's Appointments
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/appointments')}>
              <Text style={{ fontSize: 13, color: Colors.primary }}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {todayAppts && todayAppts.length > 0 ? (
          todayAppts.map((a) => <AppointmentCard key={a.id} appointment={a} />)
        ) : (
          <View
            style={{
              marginHorizontal: 16,
              alignItems: 'center',
              paddingVertical: 20,
              backgroundColor: Colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: Colors.border,
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="calendar-outline" size={28} color={Colors.gray300} />
            <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 8 }}>
              No appointments today
            </Text>
          </View>
        )}

        {/* My Pending Tasks */}
        <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text }}>
              My Pending Tasks
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
              <Text style={{ fontSize: 13, color: Colors.primary }}>See all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {pendingTasks && pendingTasks.length > 0 ? (
          pendingTasks.map((t) => <TaskCard key={t.id} task={t} />)
        ) : (
          <View
            style={{
              marginHorizontal: 16,
              alignItems: 'center',
              paddingVertical: 20,
              backgroundColor: Colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: Colors.border,
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={28} color={Colors.gray300} />
            <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 8 }}>
              No pending tasks
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
