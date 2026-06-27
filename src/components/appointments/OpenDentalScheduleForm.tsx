'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { format, addMonths, startOfDay } from 'date-fns'
import { Clock, Stethoscope, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Patient {
  id: string
  name: string
  email: string | null
  phone: string
}

interface Provider {
  provNum: number
  name: string
}

interface OpenSlot {
  start: string // naive clinic-local "yyyy-MM-dd HH:mm:ss"
  startUtc: string | null
  provNum: number
  opNum: number
  lengthMinutes: number
}

interface OpenDentalScheduleFormProps {
  patientId: string
  patient: Patient
  providers: Provider[]
  timeZone: string
  defaultProvNum?: number | null
  defaultLengthMinutes?: number | null
}

const LENGTH_OPTIONS = [15, 20, 30, 40, 45, 60, 90]

function slotTimeLabel(naive: string, fmt: '12h' | '24h'): string {
  const m = naive.match(/[ T](\d{2}):(\d{2})/)
  if (!m) return naive
  const h = Number(m[1])
  const min = m[2]
  if (fmt === '24h') return `${String(h).padStart(2, '0')}:${min}`
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${min}${period}`
}

export function OpenDentalScheduleForm({
  patientId,
  patient,
  providers,
  timeZone,
  defaultProvNum,
  defaultLengthMinutes,
}: OpenDentalScheduleFormProps) {
  const router = useRouter()
  const [provNum, setProvNum] = useState<string>(defaultProvNum ? String(defaultProvNum) : '')
  const [lengthMinutes, setLengthMinutes] = useState<number>(defaultLengthMinutes || 30)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<OpenSlot | null>(null)
  const [reason, setReason] = useState<string>('')
  const [slots, setSlots] = useState<OpenSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string>('')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')

  const fetchSlots = useCallback(async () => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setError('')
    setSlots([])
    setSelectedSlot(null)
    try {
      const dateStart = format(selectedDate, 'yyyy-MM-dd')
      const params = new URLSearchParams({ dateStart, lengthMinutes: String(lengthMinutes) })
      if (provNum) params.set('provNum', provNum)
      const res = await fetch(`/api/appointments/opendental/slots?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch available times')
      setSlots(data.slots || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch available times')
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedDate, lengthMinutes, provNum])

  useEffect(() => {
    if (selectedDate) fetchSlots()
    else {
      setSlots([])
      setSelectedSlot(null)
    }
  }, [selectedDate, lengthMinutes, provNum, fetchSlots])

  const handleDateSelect = (date: Date) => {
    if (startOfDay(date) >= startOfDay(new Date())) {
      setSelectedDate(date)
      setSelectedSlot(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedSlot) {
      setError('Please select an available time')
      return
    }
    setBooking(true)
    try {
      const res = await fetch('/api/appointments/opendental/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          dateTimeStart: selectedSlot.start,
          provNum: selectedSlot.provNum || (provNum ? Number(provNum) : undefined),
          opNum: selectedSlot.opNum || undefined,
          lengthMinutes: selectedSlot.lengthMinutes || lengthMinutes,
          note: reason || undefined,
          visitType: reason || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to book appointment')
      router.push(`/patients/${patientId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment')
      setBooking(false)
    }
  }

  const minDate = startOfDay(new Date())
  const maxDate = addMonths(new Date(), 3)

  return (
    <div className="max-w-7xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top controls: provider + length */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provNum || 'any'} onValueChange={(v) => setProvNum(v === 'any' ? '' : v)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Practice default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Practice default</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.provNum} value={String(p.provNum)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="length">Appointment length</Label>
            <Select value={String(lengthMinutes)} onValueChange={(v) => setLengthMinutes(Number(v))}>
              <SelectTrigger id="length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">{patient.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{lengthMinutes}m</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Stethoscope className="h-4 w-4 text-gray-400" />
              <span>
                {provNum
                  ? providers.find((p) => String(p.provNum) === provNum)?.name || 'Selected provider'
                  : 'Practice default provider'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Globe className="h-4 w-4 text-gray-400" />
              <span>{timeZone}</span>
            </div>
            <p className="text-xs text-gray-400">Open Dental schedule</p>
          </div>

          {/* Middle: calendar */}
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

          {/* Right: times */}
          <div className="space-y-4">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900">{format(selectedDate, 'EEE d')}</h4>
                  <div className="flex gap-0.5 border border-gray-200 rounded-md p-0.5 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setTimeFormat('12h')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded transition-colors',
                        timeFormat === '12h' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      12h
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeFormat('24h')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded transition-colors',
                        timeFormat === '24h' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      24h
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {loadingSlots ? (
                    <div className="p-4 text-center text-sm text-gray-500">Loading available times...</div>
                  ) : slots.length === 0 ? (
                    <div className="p-4 text-center text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg">
                      No open times for this date. Try another date, provider, or length.
                    </div>
                  ) : (
                    slots.map((slot, index) => {
                      const isSelected = selectedSlot?.start === slot.start && selectedSlot?.opNum === slot.opNum
                      return (
                        <button
                          key={`${slot.start}-${slot.opNum}-${index}`}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border-2 transition-all',
                            isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                isSelected ? 'bg-white' : 'bg-green-500'
                              )}
                            />
                            <span className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-gray-900')}>
                              {slotTimeLabel(slot.start, timeFormat)}
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

        {selectedSlot && (
          <div className="mt-6 space-y-2">
            <Label htmlFor="reason">Reason / Notes (Optional)</Label>
            <Input
              id="reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Cleaning, Crown prep, Follow-up"
            />
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={booking}>
            Cancel
          </Button>
          <Button type="submit" disabled={booking || !selectedSlot} className="flex-1">
            {booking ? 'Booking...' : 'Book Appointment'}
          </Button>
        </div>
      </form>
    </div>
  )
}
