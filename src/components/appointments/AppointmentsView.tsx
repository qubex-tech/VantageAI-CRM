'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, List, Search, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppointmentsListView } from './AppointmentsListView'
import { AppointmentsCalendarView } from './AppointmentsCalendarView'

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

interface AppointmentsViewProps {
  initialAppointments: Appointment[]
}

type ViewMode = 'list' | 'calendar'

export function AppointmentsView({ initialAppointments }: AppointmentsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>((searchParams?.get('view') as ViewMode) || 'list')
  const [appointments, setAppointments] = useState(initialAppointments)
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || 'all')
  const [dateFilter, setDateFilter] = useState(searchParams?.get('date') || '')

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (viewMode !== 'list') params.set('view', viewMode)
    if (searchQuery) params.set('search', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (dateFilter) params.set('date', dateFilter)
    
    const newUrl = params.toString() ? `?${params.toString()}` : ''
    router.replace(`/appointments${newUrl}`, { scroll: false })
  }, [viewMode, searchQuery, statusFilter, dateFilter, router])

  // Filter appointments
  useEffect(() => {
    let filtered = [...initialAppointments]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(apt => 
        apt.patient.name.toLowerCase().includes(query) ||
        apt.patient.phone?.toLowerCase().includes(query) ||
        apt.patient.primaryPhone?.toLowerCase().includes(query) ||
        apt.visitType?.toLowerCase().includes(query) ||
        apt.reason?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter)
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter)
      const startOfDay = new Date(filterDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(filterDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.startTime)
        return aptDate >= startOfDay && aptDate <= endOfDay
      })
    }

    setAppointments(filtered)
  }, [initialAppointments, searchQuery, statusFilter, dateFilter])

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setDateFilter('')
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter

  return (
    <div className="space-y-4">
      {/* Header with View Toggle and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
          </div>

          <Link href="/appointments/new">
            <Button size="sm" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New Appointment
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search appointments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-[160px]"
            placeholder="Filter by date"
          />

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-gray-500">Active filters:</span>
          {searchQuery && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
              Search: {searchQuery}
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
              Status: {statusFilter}
            </span>
          )}
          {dateFilter && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
              Date: {new Date(dateFilter).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* View Content */}
      {viewMode === 'list' ? (
        <AppointmentsListView appointments={appointments} />
      ) : (
        <AppointmentsCalendarView 
          appointments={appointments}
          selectedDate={dateFilter ? new Date(dateFilter) : undefined}
          onDateSelect={(date) => setDateFilter(date ? date.toISOString().split('T')[0] : '')}
        />
      )}
    </div>
  )
}
