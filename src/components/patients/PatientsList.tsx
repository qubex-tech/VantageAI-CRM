'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PatientFilters, FilterRule } from './PatientFilters'

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

export function PatientsList({ initialPatients }: PatientsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams?.get('search') || '')
  const [patients, setPatients] = useState(initialPatients)
  
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

  const filteredPatients = patients.filter((patient) => {
    // Basic search filter
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        patient.name.toLowerCase().includes(searchLower) ||
        patient.phone.includes(search) ||
        (patient.email && patient.email.toLowerCase().includes(searchLower))
      if (!matchesSearch) return false
    }

    // Advanced filters
    return filters.every((filter) => {
      const field = filter.field
      const operator = filter.operator
      const value = filter.value
      const appointmentCount = patient._count?.appointments ?? 0

      let fieldValue: string | number | null = null

      switch (field) {
        case 'name':
          fieldValue = patient.name
          break
        case 'email':
          fieldValue = patient.email || ''
          break
        case 'phone':
          fieldValue = patient.phone
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

  return (
    <div className="space-y-4">
      <PatientFilters
        searchQuery={search}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {filteredPatients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No patients found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Appointments
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => {
                  const age = calculateAge(patient.dateOfBirth)
                  const appointmentsCount = patient._count?.appointments || 0
                  
                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm font-medium text-gray-900 hover:text-gray-700"
                        >
                          {patient.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900"
                        >
                          {age} years
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900"
                        >
                          {patient.phone}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900"
                        >
                          {patient.email || <span className="text-gray-400">—</span>}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="block text-sm text-gray-900"
                        >
                          {appointmentsCount}
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
