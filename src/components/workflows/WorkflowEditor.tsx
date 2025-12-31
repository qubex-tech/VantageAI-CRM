'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, ChevronDown, Save, Eye } from 'lucide-react'
import { TriggerBlock } from './TriggerBlock'
import { ActionBlock } from './ActionBlock'
import { ConditionBlock } from './ConditionBlock'

interface WorkflowEditorProps {
  practiceId: string
  workflowId?: string
}

export function WorkflowEditor({ practiceId, workflowId }: WorkflowEditorProps) {
  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [trigger, setTrigger] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [isPublished, setIsPublished] = useState(false)

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

  const handleSave = async () => {
    // TODO: Implement save logic
    console.log('Saving workflow:', { workflowName, trigger, steps })
  }

  const handlePublish = async () => {
    // TODO: Implement publish logic
    setIsPublished(true)
    console.log('Publishing workflow')
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
          <Button variant="outline" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          {!isPublished && (
            <Button onClick={handlePublish} className="bg-blue-600 hover:bg-blue-700 text-white">
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
      <div className="bg-gray-50 rounded-lg p-6 min-h-[600px]">
        <div className="space-y-4 max-w-3xl mx-auto">
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
                <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-300 transform -translate-y-6" />
              )}
              {index > 0 && (
                <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-300 transform -translate-y-6" />
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
                  <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-300" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Show menu to select condition or action
                      const type = window.confirm('Add condition? (Cancel for action)') ? 'condition' : 'action'
                      handleAddStep(type)
                    }}
                    className="ml-6"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add step
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Initial Add Step Button */}
          {steps.length === 0 && trigger && (
            <div className="relative mt-4">
              <div className="absolute left-6 top-0 w-0.5 h-6 bg-gray-300" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const type = window.confirm('Add condition? (Cancel for action)') ? 'condition' : 'action'
                  handleAddStep(type)
                }}
                className="ml-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add step
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

