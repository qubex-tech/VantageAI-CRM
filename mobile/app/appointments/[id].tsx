import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { useAppointment, useUpdateAppointment } from '@/hooks/useAppointments'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { AppointmentStatusColors, Colors } from '@/constants/colors'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray100,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 13, color: Colors.textSecondary, width: 120 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: Colors.text, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: appointment, isLoading } = useAppointment(id)
  const updateAppt = useUpdateAppointment(id)

  async function handleStatusChange(status: string) {
    Alert.alert(
      'Update Status',
      `Mark appointment as ${status.replace(/_/g, ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateAppt.mutateAsync({ status })
              router.back()
            } catch {
              Alert.alert('Error', 'Could not update appointment status.')
            }
          },
        },
      ]
    )
  }

  if (isLoading || !appointment) {
    return <LoadingSpinner fullScreen message="Loading appointment…" />
  }

  const statusColor = AppointmentStatusColors[appointment.status] ?? {
    bg: Colors.gray100,
    text: Colors.gray600,
  }
  const startTime = format(parseISO(appointment.startTime), 'h:mm a')
  const endTime = format(parseISO(appointment.endTime), 'h:mm a')
  const date = format(parseISO(appointment.startTime), 'EEEE, MMMM d, yyyy')

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Appointment',
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
          {/* Header card */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text }}>
                {appointment.patient?.name ?? 'Patient'}
              </Text>
              <Badge
                label={appointment.status}
                bg={statusColor.bg}
                color={statusColor.text}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryBg, borderRadius: 8, padding: 12 }}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary }}>{date}</Text>
                <Text style={{ fontSize: 13, color: Colors.primary }}>{startTime} – {endTime}</Text>
              </View>
            </View>
          </Card>

          {/* Details */}
          <Card>
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 }}>Details</Text>
            <Row label="Visit Type" value={appointment.visitType.replace(/_/g, ' ')} />
            {appointment.reason && <Row label="Reason" value={appointment.reason} />}
            <Row label="Timezone" value={appointment.timezone} />
            {appointment.notes && <Row label="Notes" value={appointment.notes} />}
            <Row label="Created" value={format(parseISO(appointment.createdAt), 'MMM d, yyyy')} />
          </Card>

          {/* Patient actions */}
          {appointment.patient && (
            <TouchableOpacity
              onPress={() => router.push(`/patients/${appointment.patient!.id}`)}
              style={{
                backgroundColor: Colors.white,
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary }}>
                  {appointment.patient.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>Patient</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text }}>
                  {appointment.patient.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
            </TouchableOpacity>
          )}

          {/* Status actions */}
          {appointment.status === 'scheduled' && (
            <View style={{ gap: 8 }}>
              <Button
                title="Mark Confirmed"
                variant="primary"
                onPress={() => handleStatusChange('confirmed')}
                loading={updateAppt.isPending}
              />
              <Button
                title="Mark No-Show"
                variant="outline"
                onPress={() => handleStatusChange('no_show')}
              />
              <Button
                title="Cancel Appointment"
                variant="danger"
                onPress={() => handleStatusChange('cancelled')}
              />
            </View>
          )}
          {appointment.status === 'confirmed' && (
            <View style={{ gap: 8 }}>
              <Button
                title="Mark Completed"
                variant="primary"
                onPress={() => handleStatusChange('completed')}
                loading={updateAppt.isPending}
              />
              <Button
                title="Mark No-Show"
                variant="outline"
                onPress={() => handleStatusChange('no_show')}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
