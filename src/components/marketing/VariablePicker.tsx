'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface VariablePickerProps {
  onSelect: (variable: string) => void
  onClose: () => void
}

const VARIABLE_CATEGORIES = [
  {
    label: 'Patient',
    variables: [
      { key: 'patient.firstName', label: 'First Name', example: 'John' },
      { key: 'patient.lastName', label: 'Last Name', example: 'Doe' },
      { key: 'patient.preferredName', label: 'Preferred Name', example: 'Johnny' },
    ],
  },
  {
    label: 'Practice',
    variables: [
      { key: 'practice.name', label: 'Practice Name', example: 'Demo Practice' },
      { key: 'practice.phone', label: 'Phone Number', example: '+1-555-0100' },
      { key: 'practice.address', label: 'Address', example: '123 Main St' },
    ],
  },
  {
    label: 'Appointment',
    variables: [
      { key: 'appointment.date', label: 'Date', example: 'January 15, 2024' },
      { key: 'appointment.time', label: 'Time', example: '2:00 PM' },
      { key: 'appointment.location', label: 'Location', example: 'Main Office' },
      { key: 'appointment.providerName', label: 'Provider Name', example: 'Dr. Smith' },
    ],
  },
  {
    label: 'Links',
    variables: [
      { key: 'links.confirm', label: 'Confirm Link', example: 'https://example.com/confirm' },
      { key: 'links.reschedule', label: 'Reschedule Link', example: 'https://example.com/reschedule' },
      { key: 'links.cancel', label: 'Cancel Link', example: 'https://example.com/cancel' },
      { key: 'links.portalVerified', label: 'Verified Portal Link', example: 'https://portal.getvantage.tech/portal/invite?token=…' },
      { key: 'links.formRequest', label: 'Form Request Link', example: 'https://portal.getvantage.tech/portal/invite?token=…&redirect=/portal/forms/…' },
    ],
  },
]

export default function VariablePicker({ onSelect, onClose }: VariablePickerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = VARIABLE_CATEGORIES.map((category) => ({
    ...category,
    variables: category.variables.filter(
      (v) =>
        v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.variables.length > 0)

  return (
    <Card className="absolute z-50 w-96 shadow-xl border border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-900">Insert Variable</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="p-3">
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto space-y-3">
          {filteredCategories.map((category) => (
            <div key={category.label}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {category.label}
              </h4>
              <div className="space-y-1">
                {category.variables.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => {
                      onSelect(variable.key)
                      onClose()
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{variable.label}</div>
                        <div className="text-xs text-gray-500 font-mono">{variable.key}</div>
                      </div>
                      <div className="text-xs text-gray-400 group-hover:text-gray-600">
                        {variable.example}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">
              No variables found matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
