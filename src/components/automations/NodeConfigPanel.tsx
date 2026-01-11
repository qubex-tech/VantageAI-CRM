'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
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
import { Trash2, X, Loader2 } from 'lucide-react'
import { FlowNodeData } from './FlowBuilder'
import Link from 'next/link'

interface NodeConfigPanelProps {
  node: Node<FlowNodeData>
  onUpdate: (nodeId: string, config: any) => void
  onDelete: (nodeId: string) => void
  triggerEventName?: string // The event name from the trigger node
}

// Patient fields - available for all patient-related events
const PATIENT_FIELDS: Array<{ value: string; label: string; type: 'string' | 'number' | 'boolean' | 'date' }> = [
  { value: 'patient.id', label: 'Patient ID', type: 'string' },
  { value: 'patient.name', label: 'Name', type: 'string' },
  { value: 'patient.email', label: 'Email', type: 'string' },
  { value: 'patient.phone', label: 'Phone', type: 'string' },
  { value: 'patient.address', label: 'Address', type: 'string' },
  { value: 'patient.dateOfBirth', label: 'Date of Birth', type: 'date' },
  { value: 'patient.preferredContactMethod', label: 'Preferred Contact Method', type: 'string' },
  { value: 'patient.notes', label: 'Notes', type: 'string' },
  { value: 'patient.createdAt', label: 'Created At', type: 'date' },
  { value: 'patient.updatedAt', label: 'Updated At', type: 'date' },
]

// Field mappings for each event type
const EVENT_FIELDS: Record<string, Array<{ value: string; label: string; type: 'string' | 'number' | 'boolean' | 'date' }>> = {
  'crm/appointment.created': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.status', label: 'Status', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    { value: 'appointment.startTime', label: 'Start Time', type: 'date' },
    { value: 'appointment.endTime', label: 'End Time', type: 'date' },
    ...PATIENT_FIELDS,
  ],
  'crm/appointment.updated': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.status', label: 'Status', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    { value: 'changes.status', label: 'Status Changed', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/appointment.cancelled': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/appointment.confirmed': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/appointment.completed': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/appointment.no_show': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/patient.created': [
    ...PATIENT_FIELDS,
  ],
  'crm/patient.updated': [
    ...PATIENT_FIELDS,
    { value: 'changes.name', label: 'Name Changed', type: 'string' },
    { value: 'changes.email', label: 'Email Changed', type: 'string' },
    { value: 'changes.phone', label: 'Phone Changed', type: 'string' },
    { value: 'changes.address', label: 'Address Changed', type: 'string' },
    { value: 'changes.preferredContactMethod', label: 'Preferred Contact Method Changed', type: 'string' },
    { value: 'changes.notes', label: 'Notes Changed', type: 'string' },
  ],
  'crm/patient.tag_added': [
    ...PATIENT_FIELDS,
    { value: 'tag', label: 'Tag', type: 'string' },
  ],
  'crm/patient.note_created': [
    ...PATIENT_FIELDS,
    { value: 'note.type', label: 'Note Type', type: 'string' },
    { value: 'note.content', label: 'Note Content', type: 'string' },
  ],
  'crm/insurance.created': [
    { value: 'insurance.patientId', label: 'Patient ID', type: 'string' },
    { value: 'insurance.providerName', label: 'Provider Name', type: 'string' },
    { value: 'insurance.eligibilityStatus', label: 'Eligibility Status', type: 'string' },
    { value: 'insurance.memberId', label: 'Member ID', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/insurance.updated': [
    { value: 'insurance.patientId', label: 'Patient ID', type: 'string' },
    { value: 'insurance.providerName', label: 'Provider Name', type: 'string' },
    { value: 'insurance.eligibilityStatus', label: 'Eligibility Status', type: 'string' },
    { value: 'changes.eligibilityStatus', label: 'Eligibility Changed', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/message.drafted': [
    { value: 'message.patientId', label: 'Patient ID', type: 'string' },
    { value: 'message.type', label: 'Message Type', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/voice_conversation.started': [
    { value: 'conversation.patientId', label: 'Patient ID', type: 'string' },
    { value: 'conversation.callerPhone', label: 'Caller Phone', type: 'string' },
    ...PATIENT_FIELDS,
  ],
  'crm/voice_conversation.ended': [
    { value: 'conversation.patientId', label: 'Patient ID', type: 'string' },
    { value: 'conversation.outcome', label: 'Outcome', type: 'string' },
    ...PATIENT_FIELDS,
  ],
}

// Status options for appointment status field
const APPOINTMENT_STATUS_OPTIONS = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

// Contact method options
const CONTACT_METHOD_OPTIONS = [
  'phone',
  'email',
  'sms',
]

// Eligibility status options
const ELIGIBILITY_STATUS_OPTIONS = [
  'active',
  'inactive',
  'pending',
  'unknown',
]

interface MarketingTemplate {
  id: string
  name: string
  channel: 'email' | 'sms'
  status: 'draft' | 'published' | 'archived'
  editorType?: 'dragdrop' | 'html' | 'plaintext'
  subject?: string | null
  bodyHtml?: string | null
  bodyText?: string | null
  bodyJson?: any
  category: string
}

export function NodeConfigPanel({ node, onUpdate, onDelete, triggerEventName }: NodeConfigPanelProps) {
  const [config, setConfig] = useState(node.data.config || {})
  const [templates, setTemplates] = useState<MarketingTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    setConfig(node.data.config || {})
  }, [node.id, node.data.config])

  // Fetch templates when email or SMS action is selected
  useEffect(() => {
    const actionType = config.actionType
    if (actionType === 'send_email' || actionType === 'send_sms') {
      fetchTemplates(actionType === 'send_email' ? 'email' : 'sms')
    } else {
      setTemplates([])
    }
  }, [config.actionType])

  // Helper to check if selected template is drag-drop
  const selectedTemplate = config.args?.templateId 
    ? templates.find(t => t.id === config.args.templateId)
    : null
  const isDragDropTemplate = selectedTemplate?.editorType === 'dragdrop'

  const handleUpdate = (updates: any) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    // Pass the full config object so updateNodeConfig can properly merge it
    onUpdate(node.id, { config: newConfig })
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id)
    }
  }

  const fetchTemplates = async (channel: 'email' | 'sms') => {
    setLoadingTemplates(true)
    try {
      const response = await fetch(`/api/marketing/templates?channel=${channel}&status=published`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        console.error('Failed to fetch templates')
        setTemplates([])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId || templateId === '__none__') {
      // If "None" is selected, clear templateId but keep existing content
      const currentArgs = config.args || {}
      const { templateId: _, ...argsWithoutTemplateId } = currentArgs
      handleUpdate({ args: argsWithoutTemplateId })
      return
    }

    const selectedTemplate = templates.find(t => t.id === templateId)
    if (!selectedTemplate) return

    const currentArgs = config.args || {}
    const updates: any = {
      args: {
        ...currentArgs,
        templateId: templateId,
      },
    }

    if (selectedTemplate.channel === 'email') {
      // For email templates, populate subject and body
      // If template uses drag-drop builder (bodyJson), store templateId and render at execution
      // Otherwise, populate subject and bodyHtml/bodyText for immediate use
      if (selectedTemplate.editorType === 'dragdrop' && selectedTemplate.bodyJson) {
        // Drag-drop template: store templateId, execution will render bodyJson
        updates.args = {
          ...updates.args,
          subject: selectedTemplate.subject || '',
          // Body will be rendered from bodyJson during execution
        }
      } else {
        // HTML or plaintext template: populate fields directly
        updates.args = {
          ...updates.args,
          subject: selectedTemplate.subject || '',
          body: selectedTemplate.bodyHtml || selectedTemplate.bodyText || '',
        }
      }
    } else if (selectedTemplate.channel === 'sms') {
      // For SMS templates, populate message
      updates.args = {
        ...updates.args,
        message: selectedTemplate.bodyText || '',
      }
    }

    handleUpdate(updates)
  }

  // Get available fields for the trigger event
  // Always include patient fields since they're relevant for most automation scenarios
  // Also include event-specific fields when a trigger is set
  const eventSpecificFields = triggerEventName ? (EVENT_FIELDS[triggerEventName] || []) : []
  const availableFields = [...PATIENT_FIELDS, ...eventSpecificFields]
  
  // Remove duplicates (in case patient fields are already in event-specific fields)
  const uniqueFields = availableFields.filter((field, index, self) => 
    index === self.findIndex(f => f.value === field.value)
  )

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Configure Node</h3>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{node.type}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: '2rem' }}>
        {/* Trigger Configuration */}
        {node.type === 'trigger' && (
          <div className="space-y-2">
            <Label>Event</Label>
            <Select
              value={config.eventName || ''}
              onValueChange={(value) => handleUpdate({ eventName: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trigger event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crm/appointment.created">Appointment Created</SelectItem>
                <SelectItem value="crm/appointment.updated">Appointment Updated</SelectItem>
                <SelectItem value="crm/appointment.cancelled">Appointment Cancelled</SelectItem>
                <SelectItem value="crm/appointment.confirmed">Appointment Confirmed</SelectItem>
                <SelectItem value="crm/appointment.completed">Appointment Completed</SelectItem>
                <SelectItem value="crm/appointment.no_show">Appointment No-Show</SelectItem>
                <SelectItem value="crm/patient.created">Patient Created</SelectItem>
                <SelectItem value="crm/patient.updated">Patient Updated</SelectItem>
                <SelectItem value="crm/patient.tag_added">Patient Tag Added</SelectItem>
                <SelectItem value="crm/patient.note_created">Patient Note Created</SelectItem>
                <SelectItem value="crm/insurance.created">Insurance Policy Created</SelectItem>
                <SelectItem value="crm/insurance.updated">Insurance Policy Updated</SelectItem>
                <SelectItem value="crm/message.drafted">Message Drafted</SelectItem>
                <SelectItem value="crm/voice_conversation.started">Voice Call Started</SelectItem>
                <SelectItem value="crm/voice_conversation.ended">Voice Call Ended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Condition Configuration */}
        {node.type === 'condition' && (
          <div className="space-y-4">
            <div>
              <Label>Condition Logic</Label>
              <Select
                value={config.operator || 'and'}
                onValueChange={(value) => handleUpdate({ operator: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">All conditions (AND)</SelectItem>
                  <SelectItem value="or">Any condition (OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Conditions</Label>
              <div className="space-y-2 mt-2">
                {(config.conditions || []).map((condition: any, index: number) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Field</Label>
                        <Select
                          value={condition.field || ''}
                          onValueChange={(value) => {
                            const newConditions = [...(config.conditions || [])]
                            newConditions[index] = { ...condition, field: value, value: '' }
                            handleUpdate({ conditions: newConditions })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom Field</SelectItem>
                          </SelectContent>
                        </Select>
                        {condition.field === 'custom' && (
                          <Input
                            className="mt-2"
                            placeholder="Enter field path (e.g., appointment.status)"
                            value={condition.customField || ''}
                            onChange={(e) => {
                              const newConditions = [...(config.conditions || [])]
                              newConditions[index] = { ...condition, customField: e.target.value, field: `custom:${e.target.value}` }
                              handleUpdate({ conditions: newConditions })
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Operator</Label>
                        <Select
                          value={condition.operator || 'equals'}
                          onValueChange={(value) => {
                            const newConditions = [...(config.conditions || [])]
                            newConditions[index] = { ...condition, operator: value }
                            handleUpdate({ conditions: newConditions })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="not_contains">Not Contains</SelectItem>
                            <SelectItem value="exists">Exists</SelectItem>
                            <SelectItem value="not_exists">Not Exists / Is Empty</SelectItem>
                            <SelectItem value="is_empty">Is Empty</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {condition.operator !== 'exists' && condition.operator !== 'not_exists' && condition.operator !== 'is_empty' && (
                        <div>
                          <Label className="text-xs">Value</Label>
                          {condition.field === 'appointment.status' ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => {
                                const newConditions = [...(config.conditions || [])]
                                newConditions[index] = { ...condition, value }
                                handleUpdate({ conditions: newConditions })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : condition.field === 'patient.preferredContactMethod' ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => {
                                const newConditions = [...(config.conditions || [])]
                                newConditions[index] = { ...condition, value }
                                handleUpdate({ conditions: newConditions })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select contact method" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTACT_METHOD_OPTIONS.map((method) => (
                                  <SelectItem key={method} value={method}>
                                    {method.charAt(0).toUpperCase() + method.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : condition.field === 'insurance.eligibilityStatus' || condition.field === 'changes.eligibilityStatus' ? (
                            <Select
                              value={condition.value || ''}
                              onValueChange={(value) => {
                                const newConditions = [...(config.conditions || [])]
                                newConditions[index] = { ...condition, value }
                                handleUpdate({ conditions: newConditions })
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {ELIGIBILITY_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder="Enter value"
                              value={condition.value || ''}
                              onChange={(e) => {
                                const newConditions = [...(config.conditions || [])]
                                newConditions[index] = { ...condition, value: e.target.value }
                                handleUpdate({ conditions: newConditions })
                              }}
                            />
                          )}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const newConditions = (config.conditions || []).filter(
                            (_: any, i: number) => i !== index
                          )
                          handleUpdate({ conditions: newConditions })
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handleUpdate({
                      conditions: [
                        ...(config.conditions || []),
                        { field: '', operator: 'equals', value: '' },
                      ],
                    })
                  }}
                >
                  Add Condition
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Configuration */}
        {node.type === 'action' && (
          <div className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <Select
                value={config.actionType || ''}
                onValueChange={(value) => handleUpdate({ actionType: value, args: {} })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="send_sms">Send SMS</SelectItem>
                  <SelectItem value="send_reminder">Send Reminder</SelectItem>
                  <SelectItem value="create_note">Create Note</SelectItem>
                  <SelectItem value="create_task">Create Task</SelectItem>
                  <SelectItem value="update_patient_fields">Update Patient Fields</SelectItem>
                  <SelectItem value="tag_patient">Tag Patient</SelectItem>
                  <SelectItem value="update_appointment_status">Update Appointment Status</SelectItem>
                  <SelectItem value="create_insurance_policy">Create Insurance Policy</SelectItem>
                  <SelectItem value="delay_seconds">Delay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action-specific fields */}
            {config.actionType === 'send_email' && (
              <div className="space-y-2">
                <div>
                  <Label>Email Template</Label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading templates...</span>
                    </div>
                  ) : (
                    <Select
                      value={config.args?.templateId || '__none__'}
                      onValueChange={handleTemplateSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None - Use custom content</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.category ? ` (${template.category})` : ''}
                            {template.editorType === 'dragdrop' ? ' [Drag & Drop]' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {templates.length === 0 && !loadingTemplates && (
                    <p className="text-xs text-gray-500 mt-1">
                      No published email templates found.{' '}
                      <Link href="/marketing/templates/new" className="text-blue-600 hover:underline" target="_blank">
                        Create one
                      </Link>
                    </p>
                  )}
                  {isDragDropTemplate && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>Drag-and-drop template. The template will be rendered from its design during execution. You can still customize the subject below.</span>
                    </p>
                  )}
                </div>
                <div>
                  <Label>Patient ID</Label>
                  <Input
                    placeholder="{appointment.patientId} or {patient.id} (auto-filled if empty)"
                    value={config.args?.patientId || ''}
                    onChange={(e) => {
                      const currentArgs = config.args || {}
                      handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                    }}
                  />
                  <p className="text-xs text-gray-500">Leave empty to auto-fill from event data</p>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    placeholder="Email subject (populated from template if selected)"
                    value={config.args?.subject || ''}
                    onChange={(e) => {
                      const currentArgs = config.args || {}
                      handleUpdate({ args: { ...currentArgs, subject: e.target.value } })
                    }}
                  />
                </div>
                <div>
                  <Label>Body</Label>
                  {isDragDropTemplate ? (
                    <div className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-500 min-h-[100px] flex items-center">
                      <span>This template uses drag-and-drop builder. Content will be rendered from the template design during execution.</span>
                    </div>
                  ) : (
                    <textarea
                      className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="Email body (populated from template if selected)"
                      value={config.args?.body || ''}
                      onChange={(e) => {
                        const currentArgs = config.args || {}
                        handleUpdate({ args: { ...currentArgs, body: e.target.value } })
                      }}
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{'}variable{'}}'} syntax for personalization (e.g., {'{{'}patient.firstName{'}}'})
                  </p>
                </div>
              </div>
            )}

            {config.actionType === 'send_sms' && (
              <div className="space-y-2">
                <div>
                  <Label>SMS Template</Label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading templates...</span>
                    </div>
                  ) : (
                    <Select
                      value={config.args?.templateId || '__none__'}
                      onValueChange={handleTemplateSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None - Use custom content</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.category ? ` (${template.category})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {templates.length === 0 && !loadingTemplates && (
                    <p className="text-xs text-gray-500 mt-1">
                      No published SMS templates found.{' '}
                      <Link href="/marketing/templates/new" className="text-blue-600 hover:underline" target="_blank">
                        Create one
                      </Link>
                    </p>
                  )}
                </div>
                <div>
                  <Label>Patient ID</Label>
                  <Input
                    placeholder="{appointment.patientId} or {patient.id}"
                    value={config.args?.patientId || ''}
                    onChange={(e) => {
                      const currentArgs = config.args || {}
                      handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                    }}
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="SMS message (populated from template if selected)"
                    value={config.args?.message || ''}
                    onChange={(e) => {
                      const currentArgs = config.args || {}
                      handleUpdate({ args: { ...currentArgs, message: e.target.value } })
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{'}variable{'}}'} syntax for personalization (e.g., {'{{'}patient.firstName{'}}'})
                  </p>
                </div>
              </div>
            )}

            {config.actionType === 'send_reminder' && (
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                  }}
                />
                <Label>Reminder Type</Label>
                <Select
                  value={config.args?.reminderType || 'appointment'}
                  onValueChange={(value) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, reminderType: value } })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Message</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Reminder message"
                  value={config.args?.message || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, message: e.target.value } })
                  }}
                />
              </div>
            )}

            {config.actionType === 'create_note' && (
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) =>
                    handleUpdate({ args: { ...(config.args || {}), patientId: e.target.value } })
                  }
                />
                <Label>Note Type</Label>
                <Select
                  value={config.args?.type || 'general'}
                  onValueChange={(value) =>
                    handleUpdate({ args: { ...(config.args || {}), type: value } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="administrative">Administrative</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="allergy">Allergy</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Content</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Note content"
                  value={config.args?.content || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, content: e.target.value } })
                  }}
                />
              </div>
            )}

            {config.actionType === 'create_task' && (
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Task title"
                  value={config.args?.title || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, title: e.target.value } })
                  }}
                />
                <Label>Description (optional)</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Task description"
                  value={config.args?.description || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, description: e.target.value } })
                  }}
                />
                <Label>Patient ID (optional)</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                  }}
                />
                <Label>Priority</Label>
                <Select
                  value={config.args?.priority || 'medium'}
                  onValueChange={(value) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, priority: value } })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.actionType === 'tag_patient' && (
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                  }}
                />
                <Label>Tag</Label>
                <Input
                  placeholder="Tag name (e.g., 'VIP', 'Follow-up')"
                  value={config.args?.tag || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, tag: e.target.value } })
                  }}
                />
              </div>
            )}

            {config.actionType === 'update_appointment_status' && (
              <div className="space-y-2">
                <Label>Appointment ID</Label>
                <Input
                  placeholder="{appointment.id}"
                  value={config.args?.appointmentId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, appointmentId: e.target.value } })
                  }}
                />
                <Label>New Status</Label>
                <Select
                  value={config.args?.status || ''}
                  onValueChange={(value) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, status: value } })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.actionType === 'create_insurance_policy' && (
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, patientId: e.target.value } })
                  }}
                />
                <Label>Provider Name</Label>
                <Input
                  placeholder="Insurance provider name"
                  value={config.args?.providerName || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, providerName: e.target.value } })
                  }}
                />
                <Label>Member ID</Label>
                <Input
                  placeholder="Member ID"
                  value={config.args?.memberId || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, memberId: e.target.value } })
                  }}
                />
                <Label>Eligibility Status</Label>
                <Select
                  value={config.args?.eligibilityStatus || 'active'}
                  onValueChange={(value) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, eligibilityStatus: value } })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELIGIBILITY_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.actionType === 'update_patient_fields' && (
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="{appointment.patientId} or {patient.id}"
                  value={config.args?.patientId || ''}
                  onChange={(e) =>
                    handleUpdate({ args: { ...(config.args || {}), patientId: e.target.value } })
                  }
                />
                <Label>Fields to Update</Label>
                <div className="space-y-3">
                  {/* Preferred Contact Method */}
                  <div>
                    <Label className="text-xs">Preferred Contact Method</Label>
                    <Select
                      value={config.args?.fields?.preferredContactMethod || ''}
                      onValueChange={(value) => {
                        const currentArgs = config.args || {}
                        const currentFields = currentArgs.fields || {}
                        handleUpdate({
                          args: {
                            ...currentArgs,
                            fields: { ...currentFields, preferredContactMethod: value },
                          },
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select contact method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <textarea
                      className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="Notes (optional)"
                      value={config.args?.fields?.notes || ''}
                      onChange={(e) => {
                        const currentArgs = config.args || {}
                        const currentFields = currentArgs.fields || {}
                        handleUpdate({
                          args: {
                            ...currentArgs,
                            fields: { ...currentFields, notes: e.target.value },
                          },
                        })
                      }}
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input
                      placeholder="Address (optional)"
                      value={config.args?.fields?.address || ''}
                      onChange={(e) => {
                        const currentArgs = config.args || {}
                        const currentFields = currentArgs.fields || {}
                        handleUpdate({
                          args: {
                            ...currentArgs,
                            fields: { ...currentFields, address: e.target.value },
                          },
                        })
                      }}
                    />
                  </div>

                  {/* Clear all fields button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const currentArgs = config.args || {}
                      handleUpdate({
                        args: {
                          ...currentArgs,
                          fields: {},
                        },
                      })
                    }}
                  >
                    Clear All Fields
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Only allowed fields are shown above</p>
              </div>
            )}

            {config.actionType === 'delay_seconds' && (
              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={config.args?.seconds || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, seconds: parseInt(e.target.value) || 0 } })
                  }}
                />
                <p className="text-xs text-gray-500">Maximum: 86400 (24 hours)</p>
              </div>
            )}
          </div>
        )}

        {/* Node Label */}
        <div className="space-y-2">
          <Label>Node Label</Label>
          <Input
            value={node.data.label || ''}
            onChange={(e) => {
              const newConfig = { ...config, label: e.target.value }
              onUpdate(node.id, newConfig)
            }}
          />
        </div>
      </div>
    </div>
  )
}
