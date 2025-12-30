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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Patient {
  id: string
  name: string
  dateOfBirth: Date | string
  phone: string
  email: string | null
  address: string | null
  preferredContactMethod: string
  notes: string | null
  tags?: Array<{ tag: string }>
}

interface EditPatientFormProps {
  patient: Patient
  onCancel?: () => void
  onSuccess?: () => void
}

export function EditPatientForm({ patient, onCancel, onSuccess }: EditPatientFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Format date for input (YYYY-MM-DD)
  // Handle invalid or placeholder dates (like 1900-01-01)
  const formatDateForInput = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    // Check if date is a placeholder (like 1900) or invalid
    const year = d.getFullYear()
    if (isNaN(d.getTime()) || year < 1901) {
      // Return empty string or a reasonable default (today minus 30 years)
      const defaultDate = new Date()
      defaultDate.setFullYear(defaultDate.getFullYear() - 30)
      return defaultDate.toISOString().split('T')[0]
    }
    return d.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState({
    name: patient.name || '',
    dateOfBirth: formatDateForInput(patient.dateOfBirth),
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    preferredContactMethod: patient.preferredContactMethod || 'phone',
    notes: patient.notes || '',
  })

  const contactMethods = [
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'mail', label: 'Mail' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const data = {
      name: formData.name,
      dateOfBirth: formData.dateOfBirth,
      phone: formData.phone,
      email: formData.email || undefined,
      address: formData.address || undefined,
      preferredContactMethod: formData.preferredContactMethod,
      notes: formData.notes || undefined,
    }

    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update patient')
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Edit Patient Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              max={new Date().toISOString().split('T')[0]} // Prevent future dates
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredContactMethod">Preferred Contact Method *</Label>
            <Select
              value={formData.preferredContactMethod}
              onValueChange={(value) =>
                setFormData({ ...formData, preferredContactMethod: value })
              }
              required
            >
              <SelectTrigger id="preferredContactMethod">
                <SelectValue placeholder="Select contact method" />
              </SelectTrigger>
              <SelectContent>
                {contactMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

