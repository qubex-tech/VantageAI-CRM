'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronDown, Save } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TriggerBlock } from './TriggerBlock'
import { ActionBlock } from './ActionBlock'
import { ConditionBlock } from './ConditionBlock'

interface WorkflowEditorProps {
  practiceId: string
  workflowId?: string
  initialWorkflow?: {
    id: string
    name: string
    description?: string | null
    isActive: boolean
    triggerType?: string | null
    triggerConfig?: any
    steps?: Array<{
      id: string
      type: string
      order: number
      config: any
    }>
  }
}

export function WorkflowEditor({ practiceId, workflowId, initialWorkflow }: WorkflowEditorProps) {
  const [workflowName, setWorkflowName] = useState(initialWorkflow?.name || 'Untitled Workflow')
  const [trigger, setTrigger] = useState<any>(initialWorkflow?.triggerConfig || null)
  const [steps, setSteps] = useState<any[]>(
    initialWorkflow?.steps?.map(step => ({
      id: step.id,
      type: step.type,
      config: step.config,
    })) || []
  )
  const [isPublished, setIsPublished] = useState(initialWorkflow?.isActive || false)

  const handleAddStep = (type: 'condition' | 'action') => {
    const newStep = {
      id: `step-${Date.now()}`,
      type,
      config: type === 'condition' ? { field: '', operator: '', value: '' } : { action: '', params: {} },
    }
    setSteps([...steps, newStep])
  }

  const handleUpdateStep = (stepId: string, config: any) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, config } : step
    ))
  }

  const handleRemoveStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId))
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name')
      return
    }

    if (!trigger) {
      alert('Please select a trigger for the workflow')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: workflowId,
          name: workflowName,
          description: null,
          trigger,
          steps: steps.map(step => ({
            type: step.type,
            config: step.config,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save workflow')
      }

      const savedWorkflow = await response.json()
      
      // Update the URL if this is a new workflow
      if (!workflowId && savedWorkflow.id) {
        window.history.replaceState({}, '', `/automations/workflows/${savedWorkflow.id}`)
        // Reload to load the workflow with proper ID
        window.location.href = `/automations/workflows/${savedWorkflow.id}`
        return
      }

      alert('Workflow saved successfully!')
    } catch (error) {
      console.error('Error saving workflow:', error)
      alert(error instanceof Error ? error.message : 'Failed to save workflow')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name')
      return
    }

    if (!trigger) {
      alert('Please select a trigger for the workflow')
      return
    }

    // First save the workflow if it doesn't have an ID
    if (!workflowId) {
      await handleSave()
      // handleSave will redirect if it's a new workflow, so return here
      return
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to publish workflow')
      }

      setIsPublished(true)
      alert('Workflow published successfully!')
    } catch (error) {
      console.error('Error publishing workflow:', error)
      alert(error instanceof Error ? error.message : 'Failed to publish workflow')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-2xl font-semibold border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Untitled Workflow"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {!isPublished && (
            <Button 
              onClick={handlePublish} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSaving}
            >
              Publish workflow
            </Button>
          )}
        </div>
      </div>

      {/* Published Banner */}
      {!isPublished && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-blue-800">This workflow has not yet been published</p>
          <Button size="sm" onClick={handlePublish} className="bg-blue-600 hover:bg-blue-700 text-white">
            Publish workflow
          </Button>
        </div>
      )}

      {/* Workflow Builder */}
      <div className="relative rounded-lg p-6 min-h-[600px] overflow-hidden" style={{
        backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        backgroundColor: '#f9fafb',
      }}>
        <div className="space-y-4 max-w-3xl mx-auto relative z-10">
          {/* Trigger Block */}
          <TriggerBlock 
            trigger={trigger}
            onSelect={(selectedTrigger) => setTrigger(selectedTrigger)}
          />

          {/* Steps */}
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Connection Line */}
              {index === 0 && trigger && (
                <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-400 transform -translate-y-6" />
              )}
              {index > 0 && (
                <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-400 transform -translate-y-6" />
              )}

              {/* Step Block */}
              {step.type === 'condition' ? (
                <ConditionBlock
                  step={step}
                  onUpdate={(config) => handleUpdateStep(step.id, config)}
                  onRemove={() => handleRemoveStep(step.id)}
                />
              ) : (
                <ActionBlock
                  step={step}
                  onUpdate={(config) => handleUpdateStep(step.id, config)}
                  onRemove={() => handleRemoveStep(step.id)}
                />
              )}

              {/* Add Step Button */}
              {index === steps.length - 1 && (
                <div className="relative mt-4">
                  <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-400" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-6 bg-white hover:bg-gray-50 border-gray-300 shadow-sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add step
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleAddStep('condition')}>
                        <span>Condition</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddStep('action')}>
                        <span>Action</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}

          {/* Initial Add Step Button */}
          {steps.length === 0 && trigger && (
            <div className="relative mt-4">
              <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-400" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-6 bg-white hover:bg-gray-50 border-gray-300 shadow-sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add step
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleAddStep('condition')}>
                    <span>Condition</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddStep('action')}>
                    <span>Action</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

