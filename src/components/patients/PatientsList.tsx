'use client'

import { useState, useEffect } from 'react'
import { PatientCard } from './PatientCard'
import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

interface PatientsListProps {
  initialPatients: any[]
}

export function PatientsList({ initialPatients }: PatientsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams?.get('search') || '')
  const [patients, setPatients] = useState(initialPatients)

  useEffect(() => {
    setPatients(initialPatients)
  }, [initialPatients])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) {
      params.set('search', search)
    }
    router.push(`/patients?${params.toString()}`)
  }

  // Filter clientside for now (can be improved with server actions)
  const filteredPatients = patients.filter((patient) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      patient.name.toLowerCase().includes(searchLower) ||
      patient.phone.includes(search) ||
      (patient.email && patient.email.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No patients found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  )
}

