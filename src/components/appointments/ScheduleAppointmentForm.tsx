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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { format, addDays, startOfDay, parseISO } from 'date-fns'

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
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])

  // When event type or date changes, fetch available slots
  useEffect(() => {
    if (selectedEventType && selectedDate) {
      fetchAvailableSlots()
    } else {
      setAvailableSlots([])
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

      const dateObj = new Date(selectedDate)
      const dateFrom = startOfDay(dateObj).toISOString()
      const dateTo = startOfDay(addDays(dateObj, 1)).toISOString()

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

  // Get minimum date (today)
  const today = format(new Date(), 'yyyy-MM-dd')
  const maxDate = format(addDays(new Date(), 90), 'yyyy-MM-dd')

  // Filter available times for selected date
  const timeSlots = availableSlots
    .filter(slot => {
      const slotDate = format(parseISO(slot.time), 'yyyy-MM-dd')
      return slotDate === selectedDate
    })
    .map(slot => format(parseISO(slot.time), 'HH:mm'))
    .sort()

  return (
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
            setSelectedDate('')
            setSelectedTime('')
          }}
          required
        >
          <SelectTrigger id="visitType">
            <SelectValue placeholder="Select a visit type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypeMappings.length === 0 ? (
              <SelectItem value="" disabled>
                No visit types available. Please configure Cal.com event type mappings in Settings.
              </SelectItem>
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

      {/* Date Selection */}
      {selectedEventType && (
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setSelectedTime('')
            }}
            min={today}
            max={maxDate}
            required
          />
        </div>
      )}

      {/* Time Selection */}
      {selectedDate && (
        <div className="space-y-2">
          <Label htmlFor="time">Time *</Label>
          {loadingSlots ? (
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-500">
              Loading available times...
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200 text-sm text-yellow-800">
              No available time slots for this date. Please select another date.
            </div>
          ) : (
            <Select value={selectedTime} onValueChange={setSelectedTime} required>
              <SelectTrigger id="time">
                <SelectValue placeholder="Select a time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => {
                  const [hours, minutes] = time.split(':').map(Number)
                  const timeDate = new Date()
                  timeDate.setHours(hours, minutes, 0, 0)
                  return (
                    <SelectItem key={time} value={time}>
                      {format(timeDate, 'h:mm a')}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Reason (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason / Notes (Optional)</Label>
        <Input
          id="reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Follow-up appointment, Annual checkup"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
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
  )
}

