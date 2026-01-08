'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  triggerEvent: string
  conditionsJson: any
  actionsJson: any[]
  createdAt: string
  _count?: {
    runs: number
  }
}

interface AutomationsPageProps {
  initialRules: AutomationRule[]
  practiceId: string
  userId: string
}

// Available trigger events
const TRIGGER_EVENTS = [
  { value: 'crm/appointment.created', label: 'Appointment Created' },
  { value: 'crm/appointment.updated', label: 'Appointment Updated' },
  { value: 'crm/patient.created', label: 'Patient Created' },
  { value: 'crm/patient.updated', label: 'Patient Updated' },
  { value: 'crm/message.drafted', label: 'Message Drafted' },
]

// Available action types
const ACTION_TYPES = [
  { value: 'create_task', label: 'Create Task' },
  { value: 'create_note', label: 'Create Note' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'update_patient_fields', label: 'Update Patient Fields' },
  { value: 'delay_seconds', label: 'Delay' },
]

export function AutomationsPage({ initialRules, practiceId, userId }: AutomationsPageProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    triggerEvent: '',
    conditions: [] as Array<{
      field: string
      operator: string
      value: string
    }>,
    actions: [] as Array<{
      type: string
      args: Record<string, any>
    }>,
  })

  const loadRules = async () => {
    try {
      const res = await fetch('/api/automations', {
        credentials: 'include', // Include cookies for auth
      })
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('API route not found. Please restart the dev server.')
        }
        throw new Error('Failed to load rules')
      }
      const data = await res.json()
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules')
    }
  }

  const handleCreateRule = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Build conditions JSON
      const conditionsJson = formData.conditions.length > 0
        ? {
            operator: 'and',
            conditions: formData.conditions.map((c) => ({
              field: c.field,
              operator: c.operator,
              value: c.value,
            })),
          }
        : { operator: 'and', conditions: [] }

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          enabled: formData.enabled,
          triggerEvent: formData.triggerEvent,
          conditionsJson,
          actionsJson: formData.actions,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create rule')
      }

      setSuccess('Rule created successfully')
      setIsDialogOpen(false)
      setFormData({
        name: '',
        enabled: true,
        triggerEvent: '',
        conditions: [],
        actions: [],
      })
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleEnabled = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/automations/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })

      if (!res.ok) throw new Error('Failed to update rule')
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const res = await fetch(`/api/automations/${ruleId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete rule')
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule')
    }
  }

  const handleTestRule = async (rule: AutomationRule) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Create a test event matching the rule's trigger
      const res = await fetch('/api/automations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: rule.triggerEvent,
          entityType: rule.triggerEvent.includes('appointment') ? 'appointment' : 'patient',
          entityId: 'test-id',
          data: {
            // Sample test data
            appointment: {
              id: 'test-id',
              status: 'scheduled',
              patientId: 'test-patient-id',
            },
            patient: {
              id: 'test-id',
              name: 'Test Patient',
              email: 'test@example.com',
            },
          },
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to test rule')
      }

      setSuccess('Test event sent! Check automation runs.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test rule')
    } finally {
      setLoading(false)
    }
  }

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: '', operator: 'equals', value: '' },
      ],
    })
  }

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    })
  }

  const updateCondition = (index: number, field: string, value: string) => {
    const updated = [...formData.conditions]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, conditions: updated })
  }

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [
        ...formData.actions,
        { type: '', args: {} },
      ],
    })
  }

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    })
  }

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...formData.actions]
    if (field === 'type') {
      updated[index] = { type: value, args: {} }
    } else {
      updated[index] = { ...updated[index], args: { ...updated[index].args, [field]: value } }
    }
    setFormData({ ...formData, actions: updated })
  }

  // Ensure we have valid props (after hooks)
  if (!practiceId || !userId) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">Missing required information. Please log in again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pt-6 pb-4 pl-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Automation Rules</h2>
          <p className="text-sm text-gray-500">Create rules to automate workflows</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/workflows/automations/flow'}
          >
            Visual Builder
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Rule</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Automation Rule</DialogTitle>
              <DialogDescription>
                Define when and what actions to take automatically
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Send welcome email to new patients"
                />
              </div>

              <div>
                <Label htmlFor="triggerEvent">Trigger Event</Label>
                <Select
                  value={formData.triggerEvent}
                  onValueChange={(value) => setFormData({ ...formData, triggerEvent: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Conditions (optional)</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Only run this rule if these conditions are met
                </p>
                {formData.conditions.map((condition, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Field (e.g., appointment.status)"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, 'operator', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="not_equals">Not Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="exists">Exists</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Value"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeCondition(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addCondition} className="w-full">
                  Add Condition
                </Button>
              </div>

              <div>
                <Label>Actions</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Actions to perform when this rule matches
                </p>
                {formData.actions.map((action, index) => (
                  <div key={index} className="border p-3 rounded mb-2">
                    <div className="flex gap-2 mb-2">
                      <Select
                        value={action.type}
                        onValueChange={(value) => updateAction(index, 'type', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeAction(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    {action.type === 'create_note' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Patient ID (use {patientId} for dynamic)"
                          value={action.args.patientId || ''}
                          onChange={(e) => updateAction(index, 'patientId', e.target.value)}
                        />
                        <Input
                          placeholder="Note content"
                          value={action.args.content || ''}
                          onChange={(e) => updateAction(index, 'content', e.target.value)}
                        />
                      </div>
                    )}
                    {action.type === 'send_email' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Patient ID"
                          value={action.args.patientId || ''}
                          onChange={(e) => updateAction(index, 'patientId', e.target.value)}
                        />
                        <Input
                          placeholder="Subject"
                          value={action.args.subject || ''}
                          onChange={(e) => updateAction(index, 'subject', e.target.value)}
                        />
                        <Input
                          placeholder="Body"
                          value={action.args.body || ''}
                          onChange={(e) => updateAction(index, 'body', e.target.value)}
                        />
                      </div>
                    )}
                    {/* Add more action-specific fields as needed */}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addAction} className="w-full">
                  Add Action
                </Button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRule} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No automation rules yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <CardDescription>
                      Trigger: {TRIGGER_EVENTS.find((e) => e.value === rule.triggerEvent)?.label || rule.triggerEvent}
                      {rule._count?.runs && rule._count.runs > 0 && (
                        <span className="ml-2">• {rule._count.runs} runs</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/workflows/automations/flow?id=${rule.id}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestRule(rule)}
                      disabled={loading}
                    >
                      Test
                    </Button>
                    <Button
                      variant={rule.enabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleEnabled(rule.id, rule.enabled)}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">Actions:</span>{' '}
                    {Array.isArray(rule.actionsJson) ? rule.actionsJson.length : 0} action(s)
                  </div>
                  {rule.conditionsJson && (
                    <div>
                      <span className="font-medium">Conditions:</span>{' '}
                      {rule.conditionsJson && typeof rule.conditionsJson === 'object' && Array.isArray(rule.conditionsJson.conditions)
                        ? rule.conditionsJson.conditions.length
                        : 0}{' '}
                      condition(s)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

