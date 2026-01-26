'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
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

  // Get appointments for selected date
  const selectedDateAppointments = selectedDate 
    ? appointmentsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : []

  return (
    <div className="space-y-4">
      {/* Calendar Navigation */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="hidden sm:inline-flex"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextMonth}
                className="gap-2"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Week day headers - Desktop */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2 hidden sm:block"
              >
                {day}
              </div>
            ))}
            {/* Week day headers - Mobile */}
            {weekDays.map((day) => (
              <div
                key={`mobile-${day}`}
                className="text-center text-xs font-medium text-gray-500 py-1 sm:hidden"
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
                    relative min-h-[50px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg border transition-all
                    ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : 'text-gray-900 bg-white'}
                    ${isTodayDate ? 'border-blue-500 border-2 font-semibold' : 'border-gray-200'}
                    ${isSelected ? 'bg-blue-50 border-blue-500' : ''}
                    hover:bg-gray-50 cursor-pointer
                    ${!isCurrentMonth ? 'opacity-50' : ''}
                    active:scale-95 transition-transform
                  `}
                >
                  <div className="text-xs sm:text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  
                  {/* Appointment indicators */}
                  {isCurrentMonth && (
                    <div className="space-y-0.5 sm:space-y-1">
                      {dayAppointments.slice(0, 2).map((apt, idx) => (
                        <div
                          key={apt.id}
                          className={`
                            h-1 sm:h-1.5 rounded-full ${getStatusColor(apt.status)}
                            ${idx === 0 ? 'w-full' : 'w-2/3'}
                          `}
                          title={`${format(new Date(apt.startTime), 'h:mm a')} - ${apt.patient.name}`}
                        />
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">
                          +{dayAppointments.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Appointments */}
      {selectedDate && selectedDateAppointments.length > 0 && (
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedDateAppointments.length} appointment{selectedDateAppointments.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="space-y-3">
              {selectedDateAppointments
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((apt) => (
                  <Link key={apt.id} href={`/appointments/${apt.id}`}>
                    <div className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{apt.patient.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {format(new Date(apt.startTime), 'h:mm a')}
                            {apt.endTime && ` - ${format(new Date(apt.endTime), 'h:mm a')}`}
                          </p>
                          {apt.visitType && (
                            <p className="text-sm text-gray-500 mt-1">{apt.visitType}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${
                          apt.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                          apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          apt.status === 'completed' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                          apt.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
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
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Status Legend</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-xs text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-600">Cancelled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
