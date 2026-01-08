'use client'

import { Zap, GitBranch, PlayCircle, Mail, MessageSquare, FileText, User, Clock, Calendar, Shield, Phone, Tag, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FlowNodeData } from './FlowBuilder'

interface NodeSidebarProps {
  onAddNode: (type: 'trigger' | 'condition' | 'action', data: Partial<FlowNodeData>) => void
}

const TRIGGER_OPTIONS = [
  // Appointments
  { value: 'crm/appointment.created', label: 'Appointment Created', icon: Calendar, category: 'Appointments' },
  { value: 'crm/appointment.updated', label: 'Appointment Updated', icon: Calendar, category: 'Appointments' },
  { value: 'crm/appointment.cancelled', label: 'Appointment Cancelled', icon: XCircle, category: 'Appointments' },
  { value: 'crm/appointment.confirmed', label: 'Appointment Confirmed', icon: CheckCircle, category: 'Appointments' },
  { value: 'crm/appointment.completed', label: 'Appointment Completed', icon: CheckCircle, category: 'Appointments' },
  { value: 'crm/appointment.no_show', label: 'Appointment No-Show', icon: AlertCircle, category: 'Appointments' },
  
  // Patients
  { value: 'crm/patient.created', label: 'Patient Created', icon: User, category: 'Patients' },
  { value: 'crm/patient.updated', label: 'Patient Updated', icon: User, category: 'Patients' },
  { value: 'crm/patient.tag_added', label: 'Patient Tag Added', icon: Tag, category: 'Patients' },
  { value: 'crm/patient.note_created', label: 'Patient Note Created', icon: FileText, category: 'Patients' },
  
  // Insurance
  { value: 'crm/insurance.created', label: 'Insurance Policy Created', icon: Shield, category: 'Insurance' },
  { value: 'crm/insurance.updated', label: 'Insurance Policy Updated', icon: Shield, category: 'Insurance' },
  
  // Communication
  { value: 'crm/message.drafted', label: 'Message Drafted', icon: MessageSquare, category: 'Communication' },
  { value: 'crm/voice_conversation.started', label: 'Voice Call Started', icon: Phone, category: 'Communication' },
  { value: 'crm/voice_conversation.ended', label: 'Voice Call Ended', icon: Phone, category: 'Communication' },
]

const ACTION_OPTIONS = [
  // Communication
  { value: 'send_email', label: 'Send Email', icon: Mail, category: 'Communication' },
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, category: 'Communication' },
  { value: 'send_reminder', label: 'Send Reminder', icon: AlertCircle, category: 'Communication' },
  
  // Patient Management
  { value: 'create_note', label: 'Create Note', icon: FileText, category: 'Patient Management' },
  { value: 'create_task', label: 'Create Task', icon: PlayCircle, category: 'Patient Management' },
  { value: 'update_patient_fields', label: 'Update Patient Fields', icon: User, category: 'Patient Management' },
  { value: 'tag_patient', label: 'Tag Patient', icon: Tag, category: 'Patient Management' },
  
  // Appointments
  { value: 'update_appointment_status', label: 'Update Appointment Status', icon: Calendar, category: 'Appointments' },
  
  // Insurance
  { value: 'create_insurance_policy', label: 'Create Insurance Policy', icon: Shield, category: 'Insurance' },
  
  // Control Flow
  { value: 'delay_seconds', label: 'Delay', icon: Clock, category: 'Control Flow' },
]

export function NodeSidebar({ onAddNode }: NodeSidebarProps) {
  // Group triggers by category
  const triggersByCategory = TRIGGER_OPTIONS.reduce((acc, trigger) => {
    const category = trigger.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(trigger)
    return acc
  }, {} as Record<string, typeof TRIGGER_OPTIONS>)

  // Group actions by category
  const actionsByCategory = ACTION_OPTIONS.reduce((acc, action) => {
    const category = action.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(action)
    return acc
  }, {} as Record<string, typeof ACTION_OPTIONS>)

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 pb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Add Nodes
        </h3>

        {/* Triggers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-medium text-gray-900">Triggers</h4>
          </div>
          {Object.entries(triggersByCategory).map(([category, triggers]) => (
            <div key={category} className="mb-3">
              <p className="text-xs text-gray-400 mb-1 px-1">{category}</p>
              <div className="space-y-1">
                {triggers.map((trigger) => (
                  <Card
                    key={trigger.value}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      onAddNode('trigger', {
                        label: trigger.label,
                        config: { eventName: trigger.value },
                      })
                    }
                  >
                    <CardContent className="p-3 flex items-center gap-2">
                      <trigger.icon className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">{trigger.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Conditions */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-medium text-gray-900">Conditions</h4>
          </div>
          <Card
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() =>
              onAddNode('condition', {
                label: 'If Condition',
                config: { conditions: [], operator: 'and' },
              })
            }
          >
            <CardContent className="p-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-700">Add Condition</span>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="pb-8">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-medium text-gray-900">Actions</h4>
          </div>
          {Object.entries(actionsByCategory).map(([category, actions]) => (
            <div key={category} className="mb-3">
              <p className="text-xs text-gray-400 mb-1 px-1">{category}</p>
              <div className="space-y-1">
                {actions.map((action) => (
                  <Card
                    key={action.value}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      onAddNode('action', {
                        label: action.label,
                        config: { actionType: action.value, args: {} },
                      })
                    }
                  >
                    <CardContent className="p-3 flex items-center gap-2">
                      <action.icon className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-gray-700">{action.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

