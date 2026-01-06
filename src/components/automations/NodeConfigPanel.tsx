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
import { Trash2, X } from 'lucide-react'
import { FlowNodeData } from './FlowBuilder'

interface NodeConfigPanelProps {
  node: Node<FlowNodeData>
  onUpdate: (nodeId: string, config: any) => void
  onDelete: (nodeId: string) => void
  triggerEventName?: string // The event name from the trigger node
}

// Field mappings for each event type
const EVENT_FIELDS: Record<string, Array<{ value: string; label: string; type: 'string' | 'number' | 'boolean' | 'date' }>> = {
  'crm/appointment.created': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.status', label: 'Status', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    { value: 'appointment.startTime', label: 'Start Time', type: 'date' },
    { value: 'appointment.endTime', label: 'End Time', type: 'date' },
  ],
  'crm/appointment.updated': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.status', label: 'Status', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
    { value: 'changes.status', label: 'Status Changed', type: 'string' },
  ],
  'crm/appointment.cancelled': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
  ],
  'crm/appointment.confirmed': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
  ],
  'crm/appointment.completed': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
  ],
  'crm/appointment.no_show': [
    { value: 'appointment.id', label: 'Appointment ID', type: 'string' },
    { value: 'appointment.patientId', label: 'Patient ID', type: 'string' },
    { value: 'appointment.visitType', label: 'Visit Type', type: 'string' },
  ],
  'crm/patient.created': [
    { value: 'patient.id', label: 'Patient ID', type: 'string' },
    { value: 'patient.name', label: 'Name', type: 'string' },
    { value: 'patient.email', label: 'Email', type: 'string' },
    { value: 'patient.phone', label: 'Phone', type: 'string' },
    { value: 'patient.preferredContactMethod', label: 'Preferred Contact', type: 'string' },
  ],
  'crm/patient.updated': [
    { value: 'patient.id', label: 'Patient ID', type: 'string' },
    { value: 'patient.name', label: 'Name', type: 'string' },
    { value: 'patient.email', label: 'Email', type: 'string' },
    { value: 'patient.phone', label: 'Phone', type: 'string' },
    { value: 'changes.name', label: 'Name Changed', type: 'string' },
    { value: 'changes.email', label: 'Email Changed', type: 'string' },
  ],
  'crm/patient.tag_added': [
    { value: 'patient.id', label: 'Patient ID', type: 'string' },
    { value: 'tag', label: 'Tag', type: 'string' },
  ],
  'crm/patient.note_created': [
    { value: 'patient.id', label: 'Patient ID', type: 'string' },
    { value: 'note.type', label: 'Note Type', type: 'string' },
    { value: 'note.content', label: 'Note Content', type: 'string' },
  ],
  'crm/insurance.created': [
    { value: 'insurance.patientId', label: 'Patient ID', type: 'string' },
    { value: 'insurance.providerName', label: 'Provider Name', type: 'string' },
    { value: 'insurance.eligibilityStatus', label: 'Eligibility Status', type: 'string' },
    { value: 'insurance.memberId', label: 'Member ID', type: 'string' },
  ],
  'crm/insurance.updated': [
    { value: 'insurance.patientId', label: 'Patient ID', type: 'string' },
    { value: 'insurance.providerName', label: 'Provider Name', type: 'string' },
    { value: 'insurance.eligibilityStatus', label: 'Eligibility Status', type: 'string' },
    { value: 'changes.eligibilityStatus', label: 'Eligibility Changed', type: 'string' },
  ],
  'crm/message.drafted': [
    { value: 'message.patientId', label: 'Patient ID', type: 'string' },
    { value: 'message.type', label: 'Message Type', type: 'string' },
  ],
  'crm/voice_conversation.started': [
    { value: 'conversation.patientId', label: 'Patient ID', type: 'string' },
    { value: 'conversation.callerPhone', label: 'Caller Phone', type: 'string' },
  ],
  'crm/voice_conversation.ended': [
    { value: 'conversation.patientId', label: 'Patient ID', type: 'string' },
    { value: 'conversation.outcome', label: 'Outcome', type: 'string' },
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

export function NodeConfigPanel({ node, onUpdate, onDelete, triggerEventName }: NodeConfigPanelProps) {
  const [config, setConfig] = useState(node.data.config || {})

  useEffect(() => {
    setConfig(node.data.config || {})
  }, [node.id, node.data.config])

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

  // Get available fields for the trigger event
  const availableFields = triggerEventName ? (EVENT_FIELDS[triggerEventName] || []) : []

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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                            {availableFields.length > 0 ? (
                              availableFields.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="custom">Custom Field</SelectItem>
                            )}
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
                            <SelectItem value="not_exists">Not Exists</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
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
                  <SelectItem value="draft_email">Draft Email</SelectItem>
                  <SelectItem value="draft_sms">Draft SMS</SelectItem>
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
            {config.actionType === 'draft_email' && (
              <div className="space-y-2">
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
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject"
                  value={config.args?.subject || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, subject: e.target.value } })
                  }}
                />
                <Label>Body</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Email body"
                  value={config.args?.body || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, body: e.target.value } })
                  }}
                />
              </div>
            )}

            {config.actionType === 'draft_sms' && (
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
                <Label>Message</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="SMS message"
                  value={config.args?.message || ''}
                  onChange={(e) => {
                    const currentArgs = config.args || {}
                    handleUpdate({ args: { ...currentArgs, message: e.target.value } })
                  }}
                />
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
