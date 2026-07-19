'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateAgeFromDateOnly } from '@/lib/date'
import { formatPatientDisplayName } from '@/lib/patient-name'

interface PatientCardProps {
  patient: {
    id: string
    name: string
    firstName?: string | null
    lastName?: string | null
    phone: string
    primaryPhone?: string | null
    email?: string | null
    dateOfBirth: Date
    createdAt: Date
    _count?: {
      appointments: number
      insurancePolicies: number
    }
  }
}

export function PatientCard({ patient }: PatientCardProps) {
  const age = calculateAgeFromDateOnly(patient.dateOfBirth)
  const displayName = formatPatientDisplayName(patient)

  return (
    <Link href={`/patients/${patient.id}`}>
      <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">{displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-gray-600 space-y-1">
            <p>Age: {age} years</p>
            <p>Phone: {patient.primaryPhone || patient.phone}</p>
            {patient.email && <p>Email: {patient.email}</p>}
          </div>
          {patient._count && (
            <div className="flex gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
              <span>{patient._count.appointments} appointments</span>
              <span>{patient._count.insurancePolicies} insurance policies</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

