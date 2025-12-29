'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarMonth } from '@/components/ui/calendar-month'
import { format, addDays, startOfDay, parseISO, addMonths } from 'date-fns'
import { Clock, Video, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Patient {
  id: string
  name: string
  email: string | null
  phone: string
}

interface EventTypeMapping {
  id: string
  visitTypeName: string
  calEventTypeId: string
}

interface AvailableSlot {
  time: string
  attendeeCount: number
}

interface ScheduleAppointmentFormProps {
  patientId: string
  patient: Patient
  eventTypeMappings: EventTypeMapping[]
}

export function ScheduleAppointmentForm({
  patientId,
  patient,
  eventTypeMappings,
}: ScheduleAppointmentFormProps) {
  const router = useRouter()
  const [selectedEventType, setSelectedEventType] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')

  const selectedMapping = eventTypeMappings.find(m => m.id === selectedEventType)

  // When event type or date changes, fetch available slots
  useEffect(() => {
    if (selectedEventType && selectedDate) {
      fetchAvailableSlots()
    } else {
      setAvailableSlots([])
      setSelectedTime('')
    }
  }, [selectedEventType, selectedDate])

  const fetchAvailableSlots = async () => {
    if (!selectedEventType || !selectedDate) return

    setLoadingSlots(true)
    setError('')
    setAvailableSlots([])
    setSelectedTime('')

    try {
      const mapping = eventTypeMappings.find(m => m.id === selectedEventType)
      if (!mapping) {
        setError('Invalid event type selected')
        return
      }

      const dateFrom = startOfDay(selectedDate).toISOString()
      const dateTo = startOfDay(addDays(selectedDate, 1)).toISOString()

      const params = new URLSearchParams({
        eventTypeId: mapping.calEventTypeId,
        dateFrom,
        dateTo,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      const response = await fetch(`/api/appointments/slots?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch available slots')
      }

      setAvailableSlots(data.slots || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch available slots')
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleDateSelect = (date: Date) => {
    // Only allow dates from today onwards
    const today = startOfDay(new Date())
    const selected = startOfDay(date)
    if (selected >= today) {
      setSelectedDate(date)
      setSelectedTime('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedEventType || !selectedDate || !selectedTime) {
      setError('Please select a visit type, date, and time')
      setLoading(false)
      return
    }

    try {
      const mapping = eventTypeMappings.find(m => m.id === selectedEventType)
      if (!mapping) {
        throw new Error('Invalid event type selected')
      }

      // Combine date and time
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const dateTime = new Date(selectedDate)
      dateTime.setHours(hours, minutes, 0, 0)

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          eventTypeId: mapping.calEventTypeId,
          startTime: dateTime.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          reason: reason || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create appointment')
      }

      // Redirect to patient detail page or appointments list
      router.push(`/patients/${patientId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment')
      setLoading(false)
    }
  }

  const minDate = startOfDay(new Date())
  const maxDate = addMonths(new Date(), 3) // 3 months in advance

  // Filter available times for selected date
  const timeSlots = selectedDate
    ? availableSlots
        .filter(slot => {
          const slotDate = startOfDay(parseISO(slot.time))
          const selected = startOfDay(selectedDate)
          return slotDate.getTime() === selected.getTime()
        })
        .map(slot => parseISO(slot.time))
        .sort((a, b) => a.getTime() - b.getTime())
    : []

  const formatTime = (date: Date) => {
    if (timeFormat === '24h') {
      return format(date, 'HH:mm')
    }
    return format(date, 'h:mmaaa').toLowerCase()
  }

  if (!selectedEventType) {
    // Initial state: show visit type selection
    return (
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Info */}
          <div className="space-y-2">
            <Label>Patient</Label>
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="font-medium text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-500">{patient.phone}</p>
              {patient.email && <p className="text-sm text-gray-500">{patient.email}</p>}
            </div>
          </div>

          {/* Visit Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="visitType">Visit Type *</Label>
            <Select
              value={selectedEventType}
              onValueChange={(value) => {
                setSelectedEventType(value)
                setSelectedDate(null)
                setSelectedTime('')
              }}
              required
            >
              <SelectTrigger id="visitType">
                <SelectValue placeholder="Select a visit type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeMappings.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-gray-500">
                    No visit types available. Please configure Cal.com event type mappings in Settings.
                  </div>
                ) : (
                  eventTypeMappings.map((mapping) => (
                    <SelectItem key={mapping.id} value={mapping.id}>
                      {mapping.visitTypeName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {eventTypeMappings.length === 0 && (
              <p className="text-sm text-gray-500">
                Go to Settings → Cal.com Integration to map event types to visit types.
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // Calendar view with three columns
  return (
    <div className="max-w-7xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Booking Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{patient.name}</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedMapping?.visitTypeName}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>30m</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Video className="h-4 w-4 text-gray-400" />
                  <span>Cal Video</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span className="flex-1 text-gray-900">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column: Calendar */}
          <div className="flex justify-center">
            <div className="w-full max-w-sm">
              <CalendarMonth
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          </div>

          {/* Right Column: Time Slots */}
          <div className="space-y-4">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {format(selectedDate, 'EEE d')}
                  </h4>
                  <div className="flex gap-0.5 border border-gray-200 rounded-md p-0.5 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setTimeFormat('12h')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded transition-colors',
                        timeFormat === '12h'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      12h
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeFormat('24h')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded transition-colors',
                        timeFormat === '24h'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      24h
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {loadingSlots ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Loading available times...
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 text-center text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="font-medium mb-2">No available slots found</p>
                        <p className="text-xs text-yellow-600">
                          Cal.com API v2 doesn't support slot availability. Please enter a time manually below.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="manualTime">Time *</Label>
                        <Input
                          id="manualTime"
                          type="time"
                          value={selectedTime || ''}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          required
                          className="w-full"
                        />
                      </div>
                    </div>
                  ) : (
                    timeSlots.map((slotDate, index) => {
                      const timeStr = format(slotDate, 'HH:mm')
                      const isSelected = selectedTime === timeStr
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedTime(timeStr)}
                            className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border-2 transition-all',
                            isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0',
                              isSelected ? 'bg-white' : 'bg-green-500'
                            )} />
                            <span className={cn(
                              'text-sm font-medium',
                              isSelected ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatTime(slotDate)}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                Select a date from the calendar
              </div>
            )}
          </div>
        </div>

        {/* Reason / Notes */}
        {selectedTime && (
          <div className="mt-6 space-y-2">
            <Label htmlFor="reason">Reason / Notes (Optional)</Label>
            <Input
              id="reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Follow-up appointment, Annual checkup"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedEventType || !selectedDate || !selectedTime || eventTypeMappings.length === 0}
            className="flex-1"
          >
            {loading ? 'Scheduling...' : 'Schedule Appointment'}
          </Button>
        </div>
      </form>
    </div>
  )
}
