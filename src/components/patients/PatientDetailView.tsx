'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Phone, Mail, MapPin, Edit } from 'lucide-react'
import { EditPatientForm } from './EditPatientForm'

interface Patient {
  id: string
  name: string
  dateOfBirth: Date | string
  phone: string
  email: string | null
  address: string | null
  preferredContactMethod: string
  notes: string | null
  tags?: Array<{ tag: string }>
  insurancePolicies?: Array<{
    id: string
    providerName: string
    memberId: string
    eligibilityStatus: string
  }>
  appointments?: Array<{
    id: string
    visitType: string
    startTime: Date | string
    status: string
  }>
  timelineEntries?: Array<{
    id: string
    title: string
    description: string | null
    createdAt: Date | string
  }>
}

interface PatientDetailViewProps {
  patient: Patient
}

export function PatientDetailView({ patient: initialPatient }: PatientDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [patient, setPatient] = useState(initialPatient)

  const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()

  const handleEditSuccess = () => {
    setIsEditing(false)
    // Refresh the page to get updated data
    window.location.reload()
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Edit Patient</h1>
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
        <EditPatientForm
          patient={patient}
          onCancel={() => setIsEditing(false)}
          onSuccess={handleEditSuccess}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{patient.name}</h1>
          <p className="text-gray-500">Age: {age} years</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Link href={`/appointments/new?patientId=${patient.id}`}>
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Appointment
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{patient.phone}</span>
            </div>
            {patient.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{patient.email}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span>{patient.address}</span>
              </div>
            )}
            <div className="pt-2">
              <p className="text-sm text-gray-500">
                Preferred: {patient.preferredContactMethod}
              </p>
            </div>
            {patient.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-gray-500 mb-1">Notes:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {patient.insurancePolicies && patient.insurancePolicies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Insurance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.insurancePolicies.map((policy: any) => (
                <div key={policy.id} className="border-b pb-2">
                  <p className="font-medium">{policy.providerName}</p>
                  <p className="text-sm text-gray-500">
                    Member ID: {policy.memberId}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {policy.eligibilityStatus}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {patient.appointments && patient.appointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.appointments.map((apt: any) => (
                <Link
                  key={apt.id}
                  href={`/appointments/${apt.id}`}
                  className="block border-b pb-2 hover:bg-gray-100 p-2 rounded transition-colors"
                >
                  <p className="font-medium">{apt.visitType}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(apt.startTime), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500">Status: {apt.status}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {patient.timelineEntries && patient.timelineEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No timeline entries</p>
            ) : (
              patient.timelineEntries?.map((entry: any) => (
                <div key={entry.id} className="border-b pb-2">
                  <p className="font-medium">{entry.title}</p>
                  {entry.description && (
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

