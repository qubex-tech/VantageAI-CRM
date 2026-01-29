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
  emailTemplates: Array<{ id: string; name: string; category: string }>
  smsTemplates: Array<{ id: string; name: string; category: string }>
  patients: Array<{ id: string; name: string; firstName?: string | null; lastName?: string | null; email?: string | null }>
}

export function FormRequestForm({ templates, emailTemplates, smsTemplates, patients }: FormRequestFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const defaultNotifyChannel = emailTemplates.length > 0 ? 'email' : smsTemplates.length > 0 ? 'sms' : 'none'
  const defaultNotificationTemplateId =
    defaultNotifyChannel === 'email'
      ? emailTemplates[0]?.id || ''
      : defaultNotifyChannel === 'sms'
      ? smsTemplates[0]?.id || ''
      : ''

  const [formData, setFormData] = useState({
    patientId: '',
    formTemplateId: templates[0]?.id || '',
    dueDate: '',
    message: '',
    notifyChannel: defaultNotifyChannel,
    notificationTemplateId: defaultNotificationTemplateId,
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)

    try {
      if (!formData.patientId || !formData.formTemplateId) {
        throw new Error('Select a patient and a form template.')
      }

      if (formData.notifyChannel !== 'none' && !formData.notificationTemplateId) {
        throw new Error('Select a notification template to notify the patient.')
      }

      const response = await fetch('/api/forms/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: formData.patientId,
          formTemplateId: formData.formTemplateId,
          dueDate: formData.dueDate || null,
          message: formData.message || null,
          notifyChannel: formData.notifyChannel,
          notificationTemplateId:
            formData.notifyChannel === 'none' ? null : formData.notificationTemplateId,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send form request')
      }

      if (data.notification?.status === 'failed') {
        setNotice(`Form created but notification failed: ${data.notification.error}`)
        return
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
          {notice && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md">
              {notice}
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

          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <div>
              <Label>Notify patient</Label>
              <Select
                value={formData.notifyChannel}
                onValueChange={(value) => {
                  const nextChannel = value
                  const nextTemplateId =
                    nextChannel === 'email'
                      ? emailTemplates[0]?.id || ''
                      : nextChannel === 'sms'
                      ? smsTemplates[0]?.id || ''
                      : ''
                  setFormData({
                    ...formData,
                    notifyChannel: nextChannel,
                    notificationTemplateId: nextTemplateId,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select notification channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Do not notify</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Use {'{{'}links.formRequest{'}}'} in templates to insert the portal form link.
              </p>
            </div>

            {formData.notifyChannel === 'email' && (
              <div className="space-y-2">
                <Label>Email template</Label>
                <Select
                  value={formData.notificationTemplateId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, notificationTemplateId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an email template" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} • {template.category.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {emailTemplates.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No published email templates found. Create one in Marketing → Templates.
                  </p>
                )}
              </div>
            )}

            {formData.notifyChannel === 'sms' && (
              <div className="space-y-2">
                <Label>SMS template</Label>
                <Select
                  value={formData.notificationTemplateId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, notificationTemplateId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an SMS template" />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} • {template.category.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {smsTemplates.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No published SMS templates found. Create one in Marketing → Templates.
                  </p>
                )}
              </div>
            )}
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
