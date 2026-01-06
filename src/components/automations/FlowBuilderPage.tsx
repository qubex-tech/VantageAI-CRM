'use client'

import { useState, useCallback, useMemo } from 'react'
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
  const actionsJson = actionNodes.map((node) => ({
    type: node.data.config?.actionType || 'create_note',
    args: node.data.config?.args || {},
  }))

  return {
    triggerEvent,
    conditionsJson,
    actionsJson,
  }
}

export function FlowBuilderPage({ practiceId, userId, initialRules = [] }: FlowBuilderPageProps) {
  const router = useRouter()
  const [workflowName, setWorkflowName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Convert first rule to flow if available
  const initialWorkflow = useMemo(() => {
    if (initialRules.length > 0) {
      return ruleToFlow(initialRules[0])
    }
    return undefined
  }, [initialRules])

  const handleSave = useCallback(
    async (workflow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => {
      if (!workflowName.trim()) {
        setError('Please enter a workflow name')
        return
      }

      setIsSaving(true)
      setError('')
      setSuccess('')

      try {
        const ruleData = flowToRule(workflow.nodes, workflow.edges, workflowName)

        const res = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName,
            enabled: true,
            ...ruleData,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to save workflow')
        }

        setSuccess('Workflow saved successfully!')
        setTimeout(() => {
          router.push('/workflows/automations')
        }, 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save workflow')
      } finally {
        setIsSaving(false)
      }
    },
    [workflowName, router]
  )

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
        </div>
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
        <FlowBuilder initialWorkflow={initialWorkflow} onSave={handleSave} onTest={handleTest} />
      </div>
    </div>
  )
}

