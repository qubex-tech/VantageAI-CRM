'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FormFieldDefinition } from '@/lib/form-templates'

interface PortalFormProps {
  patientId: string
  request: {
    id: string
    status: string
    template: {
      name: string
      description?: string | null
      schema: { version: number; fields: FormFieldDefinition[] }
    }
  }
}

export function PortalForm({ patientId, request }: PortalFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(request.status === 'submitted')
  const [formData, setFormData] = useState<Record<string, any>>({})

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/portal/forms/${request.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-patient-id': patientId,
        },
        body: JSON.stringify({ formData }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit form')
      }

      setSubmitted(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form')
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: FormFieldDefinition) => {
    const value = formData[field.id] ?? ''

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
            rows={4}
            placeholder={field.placeholder}
            disabled={submitted}
          />
        )
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
            placeholder={field.placeholder}
            disabled={submitted}
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
            disabled={submitted}
          />
        )
      case 'select':
        return (
          <select
            className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            value={value}
            onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
            disabled={submitted}
          >
            <option value="">Select an option</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(event) => setFormData({ ...formData, [field.id]: event.target.checked })}
              disabled={submitted}
            />
            <span className="text-sm text-gray-600">I agree</span>
          </div>
        )
      default:
        return (
          <Input
            value={value}
            onChange={(event) => setFormData({ ...formData, [field.id]: event.target.value })}
            placeholder={field.placeholder}
            disabled={submitted}
          />
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
          {error}
        </div>
      )}

      {request.template.schema.fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </Label>
          {renderField(field)}
          {field.helperText && <p className="text-xs text-gray-500">{field.helperText}</p>}
        </div>
      ))}

      <div className="pt-4 border-t border-gray-200">
        {submitted ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
            Thanks! Your form has been submitted.
          </div>
        ) : (
          <Button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit form'}
          </Button>
        )}
      </div>
    </form>
  )
}
