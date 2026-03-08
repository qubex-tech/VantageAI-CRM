import React from 'react'
import { TouchableOpacity, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Colors } from '@/constants/colors'
import type { Patient } from '@/types'

interface PatientCardProps {
  patient: Patient
}

export function PatientCard({ patient }: PatientCardProps) {
  const router = useRouter()

  const dob = patient.dateOfBirth
    ? format(parseISO(patient.dateOfBirth), 'MMM d, yyyy')
    : '—'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/patients/${patient.id}`)}
      activeOpacity={0.7}
    >
      <Card style={{ marginHorizontal: 16, marginVertical: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: Colors.primaryBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.primary }}>
              {patient.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.text }}>{patient.name}</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 1 }}>
              {dob} · {patient.phone || patient.primaryPhone || '—'}
            </Text>
            {patient.tags && patient.tags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                {patient.tags.slice(0, 3).map((tag) => (
                  <View
                    key={tag.id}
                    style={{
                      backgroundColor: Colors.primaryBg,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: Colors.primary }}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Counts + chevron */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {patient._count && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    {patient._count.appointments}
                  </Text>
                </View>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  )
}
