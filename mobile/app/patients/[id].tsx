import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { usePatient, usePatientNotes, usePatientTimeline, useAddPatientNote } from '@/hooks/usePatients'
import { useAppointments } from '@/hooks/useAppointments'
import { useTasks } from '@/hooks/useTasks'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AppointmentCard } from '@/components/appointments/AppointmentCard'
import { TaskCard } from '@/components/tasks/TaskCard'
import { AppointmentStatusColors, Colors } from '@/constants/colors'

type TabId = 'overview' | 'appointments' | 'tasks' | 'notes'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
]

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray100 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: Colors.text }}>{value}</Text>
      </View>
    </View>
  )
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [newNote, setNewNote] = useState('')

  const { data: patient, isLoading } = usePatient(id)
  const { data: notes } = usePatientNotes(id)
  const { data: appts } = useAppointments({ patientId: id })
  const { data: tasks } = useTasks({ patientId: id })
  const addNote = useAddPatientNote(id)

  async function handleAddNote() {
    if (!newNote.trim()) return
    try {
      await addNote.mutateAsync(newNote.trim())
      setNewNote('')
    } catch {
      Alert.alert('Error', 'Could not save note. Please try again.')
    }
  }

  if (isLoading || !patient) {
    return <LoadingSpinner fullScreen message="Loading patient…" />
  }

  const dob = patient.dateOfBirth
    ? format(parseISO(patient.dateOfBirth), 'MMMM d, yyyy')
    : '—'

  return (
    <>
      <Stack.Screen
        options={{
          title: patient.name,
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom']}>
        {/* Patient header */}
        <View style={{ backgroundColor: Colors.white, padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.primary }}>
                {patient.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text }}>{patient.name}</Text>
              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                DOB: {dob}
              </Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {(patient.phone || patient.primaryPhone) && (
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.successBg, borderRadius: 8, paddingVertical: 8 }}
                onPress={() => Linking.openURL(`tel:${patient.phone || patient.primaryPhone}`)}
              >
                <Ionicons name="call-outline" size={16} color={Colors.success} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.success }}>Call</Text>
              </TouchableOpacity>
            )}
            {patient.email && (
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.infoBg, borderRadius: 8, paddingVertical: 8 }}
                onPress={() => Linking.openURL(`mailto:${patient.email}`)}
              >
                <Ionicons name="mail-outline" size={16} color={Colors.info} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.info }}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={{ backgroundColor: Colors.white, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.id ? Colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? '700' : '500',
                  color: activeTab === tab.id ? Colors.primary : Colors.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {/* Overview */}
          {activeTab === 'overview' && (
            <Card>
              {patient.phone && <InfoRow icon="call-outline" label="Phone" value={patient.phone} />}
              {patient.primaryPhone && patient.primaryPhone !== patient.phone && (
                <InfoRow icon="phone-portrait-outline" label="Primary Phone" value={patient.primaryPhone} />
              )}
              {patient.email && <InfoRow icon="mail-outline" label="Email" value={patient.email} />}
              {patient.address && <InfoRow icon="location-outline" label="Address" value={patient.address} />}
              <InfoRow
                icon="chatbubble-outline"
                label="Preferred Contact"
                value={patient.preferredContactMethod.replace(/_/g, ' ')}
              />
              <InfoRow
                icon="time-outline"
                label="Patient Since"
                value={format(parseISO(patient.createdAt), 'MMMM d, yyyy')}
              />
              {patient._count && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1, backgroundColor: Colors.primaryBg, borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.primary }}>{patient._count.appointments}</Text>
                    <Text style={{ fontSize: 12, color: Colors.primary }}>Appointments</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: Colors.successBg, borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.success }}>{patient._count.insurancePolicies}</Text>
                    <Text style={{ fontSize: 12, color: Colors.success }}>Insurance Policies</Text>
                  </View>
                </View>
              )}
            </Card>
          )}

          {/* Appointments */}
          {activeTab === 'appointments' && (
            <>
              {appts && appts.length > 0 ? (
                appts.map((a) => <AppointmentCard key={a.id} appointment={a} />)
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.gray300} />
                  <Text style={{ fontSize: 15, color: Colors.textMuted, marginTop: 12 }}>No appointments</Text>
                </View>
              )}
            </>
          )}

          {/* Tasks */}
          {activeTab === 'tasks' && (
            <>
              {tasks && tasks.length > 0 ? (
                tasks.map((t) => <TaskCard key={t.id} task={t} />)
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={Colors.gray300} />
                  <Text style={{ fontSize: 15, color: Colors.textMuted, marginTop: 12 }}>No tasks</Text>
                </View>
              )}
            </>
          )}

          {/* Notes */}
          {activeTab === 'notes' && (
            <>
              {/* Add note */}
              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 }}>Add Note</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14,
                    color: Colors.text,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  multiline
                  placeholder="Type a note…"
                  placeholderTextColor={Colors.textMuted}
                  value={newNote}
                  onChangeText={setNewNote}
                />
                <TouchableOpacity
                  onPress={handleAddNote}
                  disabled={!newNote.trim() || addNote.isPending}
                  style={{
                    marginTop: 8,
                    backgroundColor: !newNote.trim() ? Colors.gray200 : Colors.primary,
                    borderRadius: 8,
                    paddingVertical: 9,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: !newNote.trim() ? Colors.gray500 : Colors.white }}>
                    {addNote.isPending ? 'Saving…' : 'Save Note'}
                  </Text>
                </TouchableOpacity>
              </Card>

              {notes && notes.length > 0 ? (
                notes.map((note) => (
                  <Card key={note.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text }}>
                        {note.author?.name ?? 'Unknown'}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                        {format(parseISO(note.createdAt), 'MMM d, h:mm a')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, color: Colors.textSecondary, lineHeight: 20 }}>{note.content}</Text>
                  </Card>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>No notes yet</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
