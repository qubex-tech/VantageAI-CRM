'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FlowBuilder, FlowNodeData } from './FlowBuilder'
import { Node, Edge } from 'reactflow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Save, ArrowLeft } from 'lucide-react'

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  triggerEvent: string
  conditionsJson: any
  actionsJson: any[]
}

interface FlowBuilderPageProps {
  practiceId: string
  userId: string
  initialRules?: AutomationRule[]
  initialRule?: AutomationRule // For editing a specific rule
}

// Convert automation rule to flow format
function ruleToFlow(rule: AutomationRule): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = []
  const edges: Edge[] = []

  // Create trigger node
  const triggerNode: Node<FlowNodeData> = {
    id: 'trigger-0',
    type: 'trigger',
    position: { x: 100, y: 200 },
    data: {
      label: rule.name || 'Trigger',
      type: 'trigger',
      config: { eventName: rule.triggerEvent },
    },
  }
  nodes.push(triggerNode)

  let lastNodeId = 'trigger-0'
  let yOffset = 200

  // Create condition node if conditions exist
  if (rule.conditionsJson && rule.conditionsJson.conditions?.length > 0) {
    const conditionNode: Node<FlowNodeData> = {
      id: 'condition-0',
      type: 'condition',
      position: { x: 350, y: yOffset },
      data: {
        label: 'Condition',
        type: 'condition',
        config: rule.conditionsJson,
      },
    }
    nodes.push(conditionNode)
    edges.push({
      id: `e-${lastNodeId}-condition-0`,
      source: lastNodeId,
      target: 'condition-0',
    })
    lastNodeId = 'condition-0'
    yOffset += 50
  }

  // Create action nodes
  rule.actionsJson.forEach((action, index) => {
    const actionNode: Node<FlowNodeData> = {
      id: `action-${index}`,
      type: 'action',
      position: { x: 600, y: yOffset + index * 150 },
      data: {
        label: action.type.replace(/_/g, ' ') || 'Action',
        type: 'action',
        config: {
          actionType: action.type,
          args: action.args || {},
        },
      },
    }
    nodes.push(actionNode)
    edges.push({
      id: `e-${lastNodeId}-action-${index}`,
      source: lastNodeId,
      target: `action-${index}`,
    })
    lastNodeId = `action-${index}`
  })

  return { nodes, edges }
}

// Convert flow to automation rule format
function flowToRule(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  name: string
): {
  triggerEvent: string
  conditionsJson: any
  actionsJson: any[]
} {
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  const conditionNodes = nodes.filter((n) => n.type === 'condition')
  const actionNodes = nodes.filter((n) => n.type === 'action')

  // Get trigger event
  const triggerEvent = triggerNode?.data.config?.eventName || 'crm/appointment.created'

  // Build conditions (combine all condition nodes)
  let conditionsJson: any = { operator: 'and', conditions: [] }
  if (conditionNodes.length > 0) {
    const firstCondition = conditionNodes[0]
    conditionsJson = firstCondition.data.config || { operator: 'and', conditions: [] }
  }

  // Build actions from action nodes
  const actionsJson = actionNodes.map((node) => {
    // Ensure args is properly extracted and serialized
    const nodeArgs = node.data.config?.args || {}
    
    console.log('[FLOW_TO_RULE] Processing action node:', {
      nodeId: node.id,
      actionType: node.data.config?.actionType,
      rawArgs: nodeArgs,
      argsType: typeof nodeArgs,
      argsKeys: Object.keys(nodeArgs),
      fullConfig: node.data.config,
    })
    
    // Deep clone to ensure all nested properties are included
    const serializedArgs = JSON.parse(JSON.stringify(nodeArgs))
    
    console.log('[FLOW_TO_RULE] Serialized args:', {
      serializedArgs,
      serializedKeys: Object.keys(serializedArgs),
    })
    
    return {
      type: node.data.config?.actionType || 'create_note',
      args: serializedArgs,
    }
  })

  return {
    triggerEvent,
    conditionsJson,
    actionsJson,
  }
}

export function FlowBuilderPage({ practiceId, userId, initialRules = [], initialRule }: FlowBuilderPageProps) {
  const router = useRouter()
  const [workflowName, setWorkflowName] = useState(initialRule?.name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isEditing = !!initialRule

  const isMissingValue = (value: any) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim().length === 0
    return false
  }

  const validateWorkflow = (workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => {
    const errors: string[] = []
    const triggerNode = workflow.nodes.find((n) => n.type === 'trigger')
    if (!triggerNode) {
      errors.push('Add a trigger before saving.')
    } else if (isMissingValue(triggerNode.data.config?.eventName)) {
      errors.push('Select a trigger event.')
    }

    const actionNodes = workflow.nodes.filter((n) => n.type === 'action')
    if (actionNodes.length === 0) {
      errors.push('Add at least one action.')
    }

    actionNodes.forEach((node, index) => {
      const actionType = node.data.config?.actionType
      const args = node.data.config?.args || {}
      const actionLabel = actionType ? actionType.replace(/_/g, ' ') : `action ${index + 1}`

      if (isMissingValue(actionType)) {
        errors.push(`Select an action type for ${actionLabel}.`)
        return
      }

      switch (actionType) {
        case 'send_email': {
          const hasTemplate = !isMissingValue(args.templateId)
          if (!hasTemplate && (isMissingValue(args.subject) || isMissingValue(args.body))) {
            errors.push(`Add subject and body (or pick a template) for ${actionLabel}.`)
          }
          break
        }
        case 'send_sms': {
          const hasTemplate = !isMissingValue(args.templateId)
          if (!hasTemplate && isMissingValue(args.message)) {
            errors.push(`Add a message (or pick a template) for ${actionLabel}.`)
          }
          break
        }
        case 'send_reminder':
          if (isMissingValue(args.message)) {
            errors.push(`Add a message for ${actionLabel}.`)
          }
          break
        case 'create_note':
          if (isMissingValue(args.content)) {
            errors.push(`Add note content for ${actionLabel}.`)
          }
          break
        case 'delay_seconds':
          if (typeof args.seconds !== 'number' || args.seconds <= 0) {
            errors.push(`Set a delay in seconds (> 0) for ${actionLabel}.`)
          }
          break
        case 'update_patient_fields': {
          const fields = args.fields || {}
          const hasFields = Object.values(fields).some((value) => !isMissingValue(value))
          if (!hasFields) {
            errors.push(`Select at least one field to update for ${actionLabel}.`)
          }
          break
        }
        case 'tag_patient':
          if (isMissingValue(args.tag)) {
            errors.push(`Add a tag for ${actionLabel}.`)
          }
          break
        case 'create_task':
          if (isMissingValue(args.title)) {
            errors.push(`Add a title for ${actionLabel}.`)
          }
          break
        case 'update_appointment_status':
          if (isMissingValue(args.appointmentId) || isMissingValue(args.status)) {
            errors.push(`Add appointment ID and status for ${actionLabel}.`)
          }
          break
        case 'create_insurance_policy':
          if (isMissingValue(args.payerNameRaw) || isMissingValue(args.memberId)) {
            errors.push(`Add payer name and member ID for ${actionLabel}.`)
          }
          break
        default:
          break
      }
    })

    return errors
  }

  // Reset workflow name when initialRule changes (e.g., when switching between edit/create)
  useEffect(() => {
    setWorkflowName(initialRule?.name || '')
    setError('')
    setSuccess('')
  }, [initialRule])

  // Convert rule to flow if editing, otherwise start with empty workflow for new rule
  const initialWorkflow = useMemo(() => {
    if (initialRule) {
      return ruleToFlow(initialRule)
    }
    // For new rules, start with empty workflow (no fallback to first rule)
    return undefined
  }, [initialRule])

  const [currentWorkflow, setCurrentWorkflow] = useState<{ nodes: Node<FlowNodeData>[]; edges: Edge[] } | null>(null)

  const handleSave = useCallback(
    async (workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => {
      if (!workflowName.trim()) {
        setError('Please enter a workflow name')
        return
      }

      const validationErrors = validateWorkflow(workflow)
      if (validationErrors.length > 0) {
        setError(validationErrors.join(' '))
        return
      }

      setIsSaving(true)
      setError('')
      setSuccess('')

      try {
        // Debug: Log the workflow nodes before conversion
        console.log('[WORKFLOW SAVE] Workflow nodes:', workflow.nodes.map(n => ({
          id: n.id,
          type: n.type,
          actionType: n.data.config?.actionType,
          args: n.data.config?.args,
          configKeys: Object.keys(n.data.config || {}),
        })))
        
        const ruleData = flowToRule(workflow.nodes, workflow.edges, workflowName)
        
        // Debug: Log the rule data to verify args are included
        console.log('[WORKFLOW SAVE] Rule data actions:', JSON.stringify(ruleData.actionsJson, null, 2))
        console.log('[WORKFLOW SAVE] Action args details:', ruleData.actionsJson.map(a => ({
          type: a.type,
          args: a.args,
          argsKeys: Object.keys(a.args || {}),
          argsValues: Object.entries(a.args || {}).map(([k, v]) => ({ key: k, value: v, type: typeof v })),
        })))

        // Use PATCH for editing, POST for creating
        const url = isEditing ? `/api/automations/${initialRule!.id}` : '/api/automations'
        const method = isEditing ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName,
            enabled: isEditing ? initialRule!.enabled : true,
            ...ruleData,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'save'} workflow`)
        }

        setSuccess(`Workflow ${isEditing ? 'updated' : 'saved'} successfully!`)
        setTimeout(() => {
          router.push('/workflows/automations')
        }, 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'save'} workflow`)
      } finally {
        setIsSaving(false)
      }
    },
    [workflowName, router, isEditing, initialRule]
  )

  const handleSaveClick = useCallback(() => {
    if (currentWorkflow) {
      handleSave(currentWorkflow)
    }
  }, [currentWorkflow, handleSave])

  const handleWorkflowChange = useCallback((workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => {
    setCurrentWorkflow(workflow)
  }, [])

  const handleTest = useCallback(() => {
    // TODO: Implement test functionality
    alert('Test functionality coming soon!')
  }, [])

  return (
    <div className="h-screen flex flex-col">
      {/* Header with name input */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/workflows/automations')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="workflow-name" className="text-sm font-medium">
              Workflow Name:
            </Label>
            <Input
              id="workflow-name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="e.g., Welcome New Patients"
              className="w-64"
            />
          </div>
          {isEditing && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Editing
            </span>
          )}
        </div>
        <Button
          onClick={handleSaveClick}
          disabled={isSaving || !workflowName.trim() || !currentWorkflow}
          className="ml-auto"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Workflow' : 'Save Workflow')}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Flow Builder */}
      <div className="flex-1 overflow-hidden">
        <FlowBuilder 
          initialWorkflow={initialWorkflow} 
          onSave={(workflow) => {
            setCurrentWorkflow(workflow)
            handleSave(workflow)
          }} 
          onTest={handleTest}
          onWorkflowChange={handleWorkflowChange}
        />
      </div>
    </div>
  )
}

