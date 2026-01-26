'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, User, Phone } from 'lucide-react'

interface Appointment {
  id: string
  patient: {
    id: string | null
    name: string
    phone: string | null
    primaryPhone: string | null
  }
  startTime: Date
  endTime: Date | null
  visitType: string | null
  status: string
  reason: string | null
  isCalBooking?: boolean
}

interface AppointmentsListViewProps {
  appointments: Appointment[]
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'scheduled':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'completed':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getStatusColorForCalendar(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'scheduled':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'completed':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export function AppointmentsListView({ appointments }: AppointmentsListViewProps) {
  if (appointments.length === 0) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No appointments found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {appointments.map((apt) => (
        <Link key={apt.id} href={`/appointments/${apt.id}`}>
          <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">
                  {apt.patient.name}
                </CardTitle>
                <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${getStatusColor(apt.status)}`}>
                  {apt.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>
                    {format(new Date(apt.startTime), 'MMM d, yyyy')} • {format(new Date(apt.startTime), 'h:mm a')}
                    {apt.endTime && ` - ${format(new Date(apt.endTime), 'h:mm a')}`}
                  </span>
                </div>
                
                {apt.visitType && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{apt.visitType}</span>
                  </div>
                )}

                {(apt.patient.phone || apt.patient.primaryPhone) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{apt.patient.primaryPhone || apt.patient.phone}</span>
                  </div>
                )}

                {apt.reason && (
                  <p className="text-sm text-gray-700 mt-2">{apt.reason}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
