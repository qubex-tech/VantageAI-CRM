'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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

interface AppointmentsCalendarViewProps {
  appointments: Appointment[]
  selectedDate?: Date
  onDateSelect?: (date: Date | null) => void
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-500'
    case 'scheduled':
      return 'bg-blue-500'
    case 'completed':
      return 'bg-gray-400'
    case 'cancelled':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

export function AppointmentsCalendarView({ 
  appointments, 
  selectedDate,
  onDateSelect 
}: AppointmentsCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())

  // Sync current month with selected date if it changes externally
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(selectedDate)
    }
  }, [selectedDate])

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {}
    appointments.forEach(apt => {
      const dateKey = format(new Date(apt.startTime), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(apt)
    })
    return grouped
  }, [appointments])

  // Get calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    onDateSelect?.(null)
  }

  const handleDateClick = (date: Date) => {
    if (onDateSelect) {
      const dateKey = format(date, 'yyyy-MM-dd')
      // Always select the date if clicked, even if no appointments
      // This allows users to clear the filter by clicking the same date again
      if (selectedDate && isSameDay(date, selectedDate)) {
        onDateSelect(null)
      } else {
        onDateSelect(date)
      }
    }
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get appointments to display
  // If a date is selected, show only that date's appointments, otherwise show all
  const displayedAppointments = selectedDate 
    ? appointmentsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : appointments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  function getStatusColorForBadge(status: string): string {
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

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Main Content Area - Appointments List */}
      <div className="flex-1 min-w-0">
        <Card className="border border-gray-200">
          <CardContent className="p-4 sm:p-6">
            {selectedDate ? (
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h3>
                <p className="text-sm text-gray-500">
                  {displayedAppointments.length} appointment{displayedAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">All Appointments</h3>
                <p className="text-sm text-gray-500">
                  {displayedAppointments.length} appointment{displayedAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {displayedAppointments.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">
                  {selectedDate ? 'No appointments on this date' : 'No appointments found'}
                </p>
                {selectedDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDateSelect?.(null)}
                    className="mt-4"
                  >
                    Clear date filter
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedAppointments.map((apt) => (
                  <Link key={apt.id} href={`/appointments/${apt.id}`}>
                    <div className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-1">{apt.patient.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span>
                              {format(new Date(apt.startTime), 'MMM d, yyyy')} • {format(new Date(apt.startTime), 'h:mm a')}
                              {apt.endTime && ` - ${format(new Date(apt.endTime), 'h:mm a')}`}
                            </span>
                          </div>
                          {apt.visitType && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{apt.visitType}</span>
                            </div>
                          )}
                          {(apt.patient.phone || apt.patient.primaryPhone) && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{apt.patient.primaryPhone || apt.patient.phone}</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border font-medium flex-shrink-0 ml-2 ${getStatusColorForBadge(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      {apt.reason && (
                        <p className="text-sm text-gray-700 mt-2">{apt.reason}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar - Calendar */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <Card className="border border-gray-200 sticky top-4">
          <CardContent className="p-4">
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={previousMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  {format(currentMonth, 'MMM yyyy')}
                </h3>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="h-8 px-2 text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Week day headers */}
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-medium text-gray-500 py-1"
                >
                  {day.substring(0, 1)}
                </div>
              ))}

              {/* Calendar days */}
              {days.map((day, dayIdx) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayAppointments = appointmentsByDate[dateKey] || []
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={dayIdx}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative aspect-square p-1 rounded-lg border transition-all text-xs
                      ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : 'text-gray-900 bg-white'}
                      ${isTodayDate ? 'border-blue-500 border-2 font-semibold' : 'border-gray-200'}
                      ${isSelected ? 'bg-blue-50 border-blue-500' : ''}
                      hover:bg-gray-50 cursor-pointer
                      ${!isCurrentMonth ? 'opacity-50' : ''}
                      active:scale-95 transition-transform
                    `}
                  >
                    <div className="text-[11px] font-medium mb-0.5">
                      {format(day, 'd')}
                    </div>
                    
                    {/* Appointment indicators */}
                    {isCurrentMonth && dayAppointments.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {dayAppointments.slice(0, 3).map((apt) => (
                          <div
                            key={apt.id}
                            className={`w-1.5 h-1.5 rounded-full ${getStatusColor(apt.status)}`}
                            title={`${format(new Date(apt.startTime), 'h:mm a')} - ${apt.patient.name}`}
                          />
                        ))}
                        {dayAppointments.length > 3 && (
                          <div className="text-[8px] text-gray-500 font-medium">
                            +{dayAppointments.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Status Legend */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-xs font-medium text-gray-900 mb-2">Status</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] text-gray-600">Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-[10px] text-gray-600">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-[10px] text-gray-600">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-[10px] text-gray-600">Cancelled</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
