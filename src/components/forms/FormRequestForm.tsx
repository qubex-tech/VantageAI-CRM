'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FormRequestFormProps {
  templates: Array<{ id: string; name: string; category: string }>
  patients: Array<{ id: string; name: string; firstName?: string | null; lastName?: string | null; email?: string | null }>
}

export function FormRequestForm({ templates, patients }: FormRequestFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    patientId: '',
    formTemplateId: templates[0]?.id || '',
    dueDate: '',
    message: '',
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.patientId || !formData.formTemplateId) {
        throw new Error('Select a patient and a form template.')
      }

      const response = await fetch('/api/forms/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: formData.patientId,
          formTemplateId: formData.formTemplateId,
          dueDate: formData.dueDate || null,
          message: formData.message || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send form request')
      }

      router.push('/forms')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send form request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>Send Form to Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Patient</Label>
            <Select
              value={formData.patientId}
              onValueChange={(value) => setFormData({ ...formData, patientId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient'}
                    {patient.email ? ` • ${patient.email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Form template</Label>
            <Select
              value={formData.formTemplateId}
              onValueChange={(value) => setFormData({ ...formData, formTemplateId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} • {template.category.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(event) => setFormData({ ...formData, message: event.target.value })}
              rows={4}
              placeholder="Optional instructions for the patient."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="submit" className="flex-1 bg-gray-900 hover:bg-gray-800 text-white" disabled={loading}>
              {loading ? 'Sending...' : 'Send form'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
