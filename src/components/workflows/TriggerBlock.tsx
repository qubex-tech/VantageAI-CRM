'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, Play } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TriggerBlockProps {
  trigger: any
  onSelect: (trigger: any) => void
}

const triggerOptions = {
  records: [
    { value: 'record_command', label: 'Record command' },
    { value: 'record_created', label: 'Record created' },
    { value: 'record_updated', label: 'Record updated' },
  ],
  appointments: [
    { value: 'appointment_created', label: 'Appointment created' },
    { value: 'appointment_updated', label: 'Appointment updated' },
    { value: 'appointment_cancelled', label: 'Appointment cancelled' },
  ],
  patients: [
    { value: 'patient_created', label: 'Patient created' },
    { value: 'patient_updated', label: 'Patient updated' },
  ],
}

export function TriggerBlock({ trigger, onSelect }: TriggerBlockProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!trigger) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Play className="h-4 w-4" />
            Trigger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Choose when this workflow should run</p>
          <Button
            variant="outline"
            onClick={() => setIsOpen(true)}
            className="w-full"
          >
            Select trigger
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>

          {isOpen && (
            <div className="mt-4 space-y-4 p-4 bg-white border border-gray-200 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Records</h4>
                <div className="space-y-1">
                  {triggerOptions.records.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSelect({ type: option.value, category: 'records' })
                        setIsOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Appointments</h4>
                <div className="space-y-1">
                  {triggerOptions.appointments.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSelect({ type: option.value, category: 'appointments' })
                        setIsOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Patients</h4>
                <div className="space-y-1">
                  {triggerOptions.patients.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSelect({ type: option.value, category: 'patients' })
                        setIsOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const triggerLabel = [
    ...triggerOptions.records,
    ...triggerOptions.appointments,
    ...triggerOptions.patients,
  ].find(opt => opt.value === trigger.type)?.label || trigger.type

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Play className="h-4 w-4" />
          Trigger
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 capitalize">{trigger.category}</p>
            <p className="text-sm text-gray-500">{triggerLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
          >
            Change
          </Button>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Records</h4>
              <div className="space-y-1">
                {triggerOptions.records.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSelect({ type: option.value, category: 'records' })
                      setIsOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-md"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Appointments</h4>
              <div className="space-y-1">
                {triggerOptions.appointments.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSelect({ type: option.value, category: 'appointments' })
                      setIsOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-md"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Patients</h4>
              <div className="space-y-1">
                {triggerOptions.patients.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSelect({ type: option.value, category: 'patients' })
                      setIsOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-md"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

