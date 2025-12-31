'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Filter } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface ConditionBlockProps {
  step: any
  onUpdate: (config: any) => void
  onRemove: () => void
}

const operatorOptions = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

// Available fields for conditions grouped by entity
const fieldOptions = [
  // Patient fields
  { value: 'patient.name', label: 'Patient Name', category: 'Patient' },
  { value: 'patient.email', label: 'Patient Email', category: 'Patient' },
  { value: 'patient.phone', label: 'Patient Phone', category: 'Patient' },
  { value: 'patient.dateOfBirth', label: 'Patient Date of Birth', category: 'Patient' },
  { value: 'patient.address', label: 'Patient Address', category: 'Patient' },
  { value: 'patient.preferredContactMethod', label: 'Preferred Contact Method', category: 'Patient' },
  { value: 'patient.notes', label: 'Patient Notes', category: 'Patient' },
  
  // Appointment fields
  { value: 'appointment.status', label: 'Appointment Status', category: 'Appointment' },
  { value: 'appointment.visitType', label: 'Visit Type', category: 'Appointment' },
  { value: 'appointment.startTime', label: 'Appointment Start Time', category: 'Appointment' },
  { value: 'appointment.endTime', label: 'Appointment End Time', category: 'Appointment' },
  { value: 'appointment.reason', label: 'Appointment Reason', category: 'Appointment' },
  { value: 'appointment.notes', label: 'Appointment Notes', category: 'Appointment' },
  
  // Insurance fields
  { value: 'insurance.providerName', label: 'Insurance Provider', category: 'Insurance' },
  { value: 'insurance.memberId', label: 'Insurance Member ID', category: 'Insurance' },
  { value: 'insurance.eligibilityStatus', label: 'Eligibility Status', category: 'Insurance' },
  
  // Call/Voice fields
  { value: 'call.duration', label: 'Call Duration', category: 'Call' },
  { value: 'call.outcome', label: 'Call Outcome', category: 'Call' },
  { value: 'call.extractedIntent', label: 'Call Intent', category: 'Call' },
]

export function ConditionBlock({ step, onUpdate, onRemove }: ConditionBlockProps) {
  const config = step.config || { field: '', operator: '', value: '' }

  // Group fields by category for better UX
  const groupedFields = fieldOptions.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, typeof fieldOptions>)

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Condition
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Field</label>
            <Select
              value={config.field || ''}
              onValueChange={(value) => onUpdate({ ...config, field: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedFields).map(([category, fields], index) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {fields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                    {index < Object.keys(groupedFields).length - 1 && <SelectSeparator />}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Operator</label>
            <Select
              value={config.operator || ''}
              onValueChange={(value) => onUpdate({ ...config, operator: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Value</label>
            <Input
              placeholder="Value"
              value={config.value || ''}
              onChange={(e) => onUpdate({ ...config, value: e.target.value })}
              disabled={config.operator === 'is_empty' || config.operator === 'is_not_empty'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

