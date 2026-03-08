import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AppointmentStatusColors, Colors } from '@/constants/colors'
import type { Appointment } from '@/types'

interface AppointmentCardProps {
  appointment: Appointment
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const router = useRouter()
  const statusColor = AppointmentStatusColors[appointment.status] ?? {
    bg: Colors.gray100,
    text: Colors.gray600,
  }

  const startTime = format(parseISO(appointment.startTime), 'h:mm a')
  const endTime = format(parseISO(appointment.endTime), 'h:mm a')
  const date = format(parseISO(appointment.startTime), 'EEE, MMM d')

  return (
    <TouchableOpacity
      onPress={() => router.push(`/appointments/${appointment.id}`)}
      activeOpacity={0.7}
    >
      <Card style={{ marginHorizontal: 16, marginVertical: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* Time column */}
          <View
            style={{
              width: 56,
              alignItems: 'center',
              backgroundColor: Colors.primaryBg,
              borderRadius: 8,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '500' }}>
              {format(parseISO(appointment.startTime), 'MMM').toUpperCase()}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.primary }}>
              {format(parseISO(appointment.startTime), 'd')}
            </Text>
          </View>

          {/* Details */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1 }}>
                {appointment.patient?.name ?? 'Unknown Patient'}
              </Text>
              <Badge
                label={appointment.status}
                bg={statusColor.bg}
                color={statusColor.text}
                size="sm"
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
              <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                {date} · {startTime} – {endTime}
              </Text>
            </View>

            {appointment.visitType && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="medical-outline" size={13} color={Colors.textSecondary} />
                <Text style={{ fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize' }}>
                  {appointment.visitType.replace(/_/g, ' ')}
                </Text>
              </View>
            )}

            {appointment.reason && (
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }} numberOfLines={1}>
                {appointment.reason}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
        </View>
      </Card>
    </TouchableOpacity>
  )
}
