'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface ActionBlockProps {
  step: any
  onUpdate: (config: any) => void
  onRemove: () => void
}

const actionOptions = [
  { value: 'send_email', label: 'Send email' },
  { value: 'create_record', label: 'Create or update record' },
  { value: 'send_notification', label: 'Send notification' },
  { value: 'update_field', label: 'Update field' },
  { value: 'create_task', label: 'Create task' },
]

export function ActionBlock({ step, onUpdate, onRemove }: ActionBlockProps) {
  const config = step.config || { action: '', params: {} }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Action
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Action</label>
          <Select
            value={config.action || ''}
            onValueChange={(value) => onUpdate({ ...config, action: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {actionOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {config.action === 'send_email' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">To</label>
              <Input
                placeholder="Email address"
                value={config.params?.to || ''}
                onChange={(e) => onUpdate({
                  ...config,
                  params: { ...config.params, to: e.target.value },
                })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Subject</label>
              <Input
                placeholder="Email subject"
                value={config.params?.subject || ''}
                onChange={(e) => onUpdate({
                  ...config,
                  params: { ...config.params, subject: e.target.value },
                })}
              />
            </div>
          </div>
        )}

        {config.action === 'create_record' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Record Type</label>
              <Select
                value={config.params?.recordType || ''}
                onValueChange={(value) => onUpdate({
                  ...config,
                  params: { ...config.params, recordType: value },
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select record type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {config.action === 'update_field' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Field</label>
              <Input
                placeholder="Field name"
                value={config.params?.field || ''}
                onChange={(e) => onUpdate({
                  ...config,
                  params: { ...config.params, field: e.target.value },
                })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Value</label>
              <Input
                placeholder="New value"
                value={config.params?.value || ''}
                onChange={(e) => onUpdate({
                  ...config,
                  params: { ...config.params, value: e.target.value },
                })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

