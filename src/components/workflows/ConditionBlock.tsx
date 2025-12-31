'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Filter } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface ConditionBlockProps {
  step: any
  onUpdate: (config: any) => void
  onRemove: () => void
}

const operatorOptions = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

export function ConditionBlock({ step, onUpdate, onRemove }: ConditionBlockProps) {
  const config = step.config || { field: '', operator: '', value: '' }

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Condition
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
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Field</label>
            <Input
              placeholder="Field name"
              value={config.field || ''}
              onChange={(e) => onUpdate({ ...config, field: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Operator</label>
            <Select
              value={config.operator || ''}
              onValueChange={(value) => onUpdate({ ...config, operator: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Value</label>
            <Input
              placeholder="Value"
              value={config.value || ''}
              onChange={(e) => onUpdate({ ...config, value: e.target.value })}
              disabled={config.operator === 'is_empty' || config.operator === 'is_not_empty'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

