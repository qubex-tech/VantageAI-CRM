'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, User, Phone, ChevronRight } from 'lucide-react'
import { AppointmentActionsBar } from './AppointmentActionsBar'

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
  providerName?: string | null
}

interface AppointmentsListViewProps {
  appointments: Appointment[]
  openDentalActions?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
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

export function AppointmentsListView({
  appointments,
  openDentalActions = false,
  selectedId,
  onSelect,
}: AppointmentsListViewProps) {
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
      {appointments.map((apt) => {
        const isSelected = selectedId === apt.id
        const isCalOnly = apt.isCalBooking === true

        return (
          <Card
            key={apt.id}
            className={`border shadow-sm transition-all ${
              isSelected
                ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
                : 'border-gray-200 hover:shadow-md hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-2 p-1">
              {onSelect && !isCalOnly && (
                <button
                  type="button"
                  onClick={() => onSelect(apt.id)}
                  className={`mt-4 ml-3 h-4 w-4 shrink-0 rounded-full border-2 ${
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                  }`}
                  aria-label={isSelected ? 'Deselect appointment' : 'Select appointment'}
                />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/appointments/${apt.id}`} className="block rounded-md p-3 hover:bg-gray-50/80">
                  <CardHeader className="p-0 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold text-gray-900">
                        {apt.patient.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2 py-1 rounded-lg border font-medium ${getStatusColor(apt.status)}`}
                        >
                          {apt.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>
                          {format(new Date(apt.startTime), 'MMM d, yyyy')} •{' '}
                          {format(new Date(apt.startTime), 'h:mm a')}
                          {apt.endTime && ` - ${format(new Date(apt.endTime), 'h:mm a')}`}
                        </span>
                      </div>

                      {apt.visitType && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{apt.visitType}</span>
                        </div>
                      )}

                      {apt.providerName && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>Provider: {apt.providerName}</span>
                        </div>
                      )}

                      {(apt.patient.phone || apt.patient.primaryPhone) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{apt.patient.primaryPhone || apt.patient.phone}</span>
                        </div>
                      )}

                      {apt.reason && <p className="text-sm text-gray-700 mt-2">{apt.reason}</p>}
                    </div>
                  </CardContent>
                </Link>

                {(isSelected || !onSelect) && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 rounded-b-lg">
                    <AppointmentActionsBar
                      appointmentId={apt.id}
                      status={apt.status}
                      openDentalActions={openDentalActions}
                      isCalBookingOnly={isCalOnly}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export { getStatusColor as getAppointmentStatusColor }
