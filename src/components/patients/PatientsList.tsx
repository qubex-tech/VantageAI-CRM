'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { PatientFilters, FilterRule } from './PatientFilters'
import { Phone, Mail, Calendar, Heart, User, CheckCircle2 } from 'lucide-react'

interface PatientsListProps {
  initialPatients: any[]
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getInsuranceStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'verified':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'missing':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'expired':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'self_pay':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getInsuranceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'verified':
      return 'Verified'
    case 'missing':
      return 'Missing'
    case 'expired':
      return 'Expired'
    case 'self_pay':
      return 'Self Pay'
    default:
      return 'Unknown'
  }
}

export function PatientsList({ initialPatients }: PatientsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams?.get('search') || '')
  const [patients, setPatients] = useState(initialPatients)
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<string>('last_interaction')
  
  // Parse filters from URL or initialize empty
  const [filters, setFilters] = useState<FilterRule[]>(() => {
    const filtersParam = searchParams?.get('filters')
    if (filtersParam) {
      try {
        return JSON.parse(decodeURIComponent(filtersParam))
      } catch {
        return []
      }
    }
    return []
  })

  useEffect(() => {
    setPatients(initialPatients)
  }, [initialPatients])

  const handleSearchChange = (query: string) => {
    setSearch(query)
    updateURL(query, filters)
  }

  const handleFiltersChange = (newFilters: FilterRule[]) => {
    setFilters(newFilters)
    updateURL(search, newFilters)
  }

  const updateURL = (searchQuery: string, filterRules: FilterRule[]) => {
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set('search', searchQuery)
    }
    if (filterRules.length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(filterRules)))
    }
    router.push(`/patients?${params.toString()}`)
  }

  const handleSelectAll = () => {
    if (selectedPatients.size === filteredPatients.length) {
      setSelectedPatients(new Set())
    } else {
      setSelectedPatients(new Set(filteredPatients.map(p => p.id)))
    }
  }

  const handleSelectPatient = (patientId: string) => {
    const newSelected = new Set(selectedPatients)
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId)
    } else {
      newSelected.add(patientId)
    }
    setSelectedPatients(newSelected)
  }

  const filteredPatients = patients.filter((patient) => {
    // Basic search filter
    if (search) {
      const searchLower = search.toLowerCase()
      const phoneNumber = patient.primaryPhone || patient.phone || ''
      const matchesSearch =
        patient.name.toLowerCase().includes(searchLower) ||
        phoneNumber.includes(search) ||
        (patient.email && patient.email.toLowerCase().includes(searchLower))
      if (!matchesSearch) return false
    }

    // Advanced filters
    return filters.every((filter) => {
      const field = filter.field
      const operator = filter.operator
      const value = filter.value
      const appointmentCount = patient._count?.appointments ?? 0
      const appointments = patient.appointments || []

      // Handle appointment_date field separately
      if (field === 'appointment_date') {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const next7Days = new Date(today)
        next7Days.setDate(next7Days.getDate() + 7)
        const next30Days = new Date(today)
        next30Days.setDate(next30Days.getDate() + 30)

        // Get the earliest upcoming appointment, or null if none
        const upcomingAppointments = appointments.filter((apt: any) => new Date(apt.startTime) >= today)
        const earliestAppointment = upcomingAppointments.length > 0 
          ? new Date(upcomingAppointments[0].startTime)
          : null

        // Get appointment dates only (without time) for comparison
        const appointmentDates = appointments.map((apt: any) => {
          const aptDate = new Date(apt.startTime)
          return new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate())
        })

        switch (operator) {
          case 'is_today':
            return appointmentDates.some((date: Date) => 
              date.getTime() === today.getTime()
            )
          case 'is_tomorrow':
            return appointmentDates.some((date: Date) => 
              date.getTime() === tomorrow.getTime()
            )
          case 'is_in_next_7_days':
            if (!earliestAppointment) return false
            const earliestDate = new Date(earliestAppointment.getFullYear(), earliestAppointment.getMonth(), earliestAppointment.getDate())
            return earliestDate >= today && earliestDate <= next7Days
          case 'is_in_next_30_days':
            if (!earliestAppointment) return false
            const earliestDate30 = new Date(earliestAppointment.getFullYear(), earliestAppointment.getMonth(), earliestAppointment.getDate())
            return earliestDate30 >= today && earliestDate30 <= next30Days
          case 'equals':
            if (!value) return true
            const targetDate = new Date(value)
            const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
            return appointmentDates.some((date: Date) => 
              date.getTime() === targetDateOnly.getTime()
            )
          case 'before':
            if (!value) return true
            const beforeDate = new Date(value)
            const beforeDateOnly = new Date(beforeDate.getFullYear(), beforeDate.getMonth(), beforeDate.getDate())
            return appointmentDates.some((date: Date) => date < beforeDateOnly)
          case 'after':
            if (!value) return true
            const afterDate = new Date(value)
            const afterDateOnly = new Date(afterDate.getFullYear(), afterDate.getMonth(), afterDate.getDate())
            return appointmentDates.some((date: Date) => date > afterDateOnly)
          case 'is_not_empty':
            return appointments.length > 0
          case 'is_empty':
            return appointments.length === 0
          default:
            return true
        }
      }

      // Handle other fields
      let fieldValue: string | number | null = null

      switch (field) {
        case 'name':
          fieldValue = patient.name
          break
        case 'email':
          fieldValue = patient.email || ''
          break
        case 'phone':
          fieldValue = patient.primaryPhone || patient.phone || ''
          break
        case 'age':
          fieldValue = calculateAge(new Date(patient.dateOfBirth))
          break
        case 'appointments':
          fieldValue = appointmentCount
          break
        default:
          return true
      }

      // Handle different operators
      switch (operator) {
        case 'equals':
          return String(fieldValue).toLowerCase() === value.toLowerCase()
        case 'not_equals':
          return String(fieldValue).toLowerCase() !== value.toLowerCase()
        case 'contains':
          return String(fieldValue).toLowerCase().includes(value.toLowerCase())
        case 'not_contains':
          return !String(fieldValue).toLowerCase().includes(value.toLowerCase())
        case 'greater_than':
          return Number(fieldValue) > Number(value)
        case 'less_than':
          return Number(fieldValue) < Number(value)
        case 'is_empty':
          return !fieldValue || String(fieldValue).trim() === ''
        case 'is_not_empty':
          return !!fieldValue && String(fieldValue).trim() !== ''
        default:
          return true
      }
    })
  })

  // Get next appointment for each patient
  const getNextAppointment = (patient: any) => {
    const appointments = patient.appointments || []
    const now = new Date()
    const upcomingAppointments = appointments.filter((apt: any) => 
      new Date(apt.startTime) >= now && apt.status !== 'cancelled'
    )
    return upcomingAppointments.length > 0 ? upcomingAppointments[0] : null
  }

  // Get primary insurance status
  const getPrimaryInsuranceStatus = (patient: any) => {
    const policies = patient.insurancePolicies || []
    if (patient.selfPay) return 'self_pay'
    if (policies.length === 0) return null
    // Get the first/primary insurance policy
    const primaryPolicy = policies[0]
    return primaryPolicy.eligibilityStatus || null
  }

  return (
    <div className="space-y-4">
      <PatientFilters
        searchQuery={search}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Filter and Sort Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
          >
            <option value="last_interaction">Top patients</option>
            <option value="recent">Recently added</option>
            <option value="next_appointment">Next appointment</option>
            <option value="name">Name A-Z</option>
          </select>
          <div className="text-sm text-gray-500">
            Sorted by {sortBy === 'last_interaction' ? 'Last interaction' : 
                     sortBy === 'recent' ? 'Recently added' :
                     sortBy === 'next_appointment' ? 'Next appointment' : 'Name'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <span className="text-sm text-gray-500">
              Advanced filter {filters.length}
            </span>
          )}
          <button
            type="button"
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Advanced filter
          </button>
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No patients found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedPatients.size === filteredPatients.length && filteredPatients.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      Patient
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      Phone
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      Email
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      Next appointment
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      Insurance status
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-gray-400" />
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                        AI
                      </span>
                      Tags
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => {
                  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null
                  const nextAppointment = getNextAppointment(patient)
                  const insuranceStatus = getPrimaryInsuranceStatus(patient)
                  const initials = getInitials(patient.name)
                  const isSelected = selectedPatients.has(patient.id)
                  
                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectPatient(patient.id)}
                          className="h-4 w-4 text-gray-900 focus:ring-gray-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700">
                              {patient.name}
                            </div>
                            {age !== null && (
                              <div className="text-xs text-gray-500">
                                {age} years
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900 hover:text-gray-700"
                        >
                          {patient.primaryPhone || patient.phone || (
                            <span className="text-gray-400">—</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900 hover:text-gray-700 truncate max-w-xs"
                        >
                          {patient.email || <span className="text-gray-400">—</span>}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900 hover:text-gray-700"
                        >
                          {nextAppointment ? (
                            <div>
                              <div className="font-medium">
                                {format(new Date(nextAppointment.startTime), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(nextAppointment.startTime), 'h:mm a')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No upcoming</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block"
                        >
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getInsuranceStatusColor(insuranceStatus)}`}>
                            {getInsuranceStatusLabel(insuranceStatus)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="flex items-center gap-1.5 flex-wrap"
                        >
                          {patient.tags && patient.tags.length > 0 ? (
                            patient.tags.slice(0, 2).map((tag: any) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                              >
                                {tag.tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                          {patient.tags && patient.tags.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{patient.tags.length - 2}
                            </span>
                          )}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
