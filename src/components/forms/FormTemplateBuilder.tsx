'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormFieldDefinition, FormFieldType } from '@/lib/form-templates'

const fieldTypes: Array<{ value: FormFieldType; label: string }> = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
]

interface FormTemplateBuilderProps {
  template?: {
    id: string
    name: string
    description?: string | null
    category: string
    schema: { version: number; fields: FormFieldDefinition[] }
    isSystem?: boolean
  }
}

export function FormTemplateBuilder({ template }: FormTemplateBuilderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'custom',
  })

  const [fields, setFields] = useState<FormFieldDefinition[]>(
    template?.schema?.fields || [
      { id: 'field_1', label: 'New field', type: 'text', required: false },
    ]
  )

  const canEdit = !template?.isSystem

  const handleFieldChange = (index: number, update: Partial<FormFieldDefinition>) => {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...update } : field))
    )
  }

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `field_${prev.length + 1}`,
        label: 'New field',
        type: 'text',
        required: false,
      },
    ])
  }

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  const payload = useMemo(() => {
    return {
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      schema: {
        version: 1,
        fields: fields.map((field) => ({
          ...field,
          options: field.type === 'select' ? field.options || [] : undefined,
        })),
      },
    }
  }, [formData, fields])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(
        template ? `/api/forms/templates/${template.id}` : '/api/forms/templates',
        {
          method: template ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save form template')
      }

      router.push('/forms/templates')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle>{template ? 'Edit Form Template' : 'Create Form Template'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intake">Intake</SelectItem>
                  <SelectItem value="consent">Consent</SelectItem>
                  <SelectItem value="medical_history">Medical history</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
                <p className="text-xs text-gray-500">Customize questions shown to patients.</p>
              </div>
              <Button type="button" variant="outline" onClick={addField} disabled={!canEdit}>
                Add field
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Input
                      value={field.label}
                      onChange={(e) => handleFieldChange(index, { label: e.target.value })}
                      placeholder="Field label"
                      disabled={!canEdit}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeField(index)}
                      disabled={!canEdit || fields.length === 1}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: FormFieldType) =>
                          handleFieldChange(index, {
                            type: value,
                            options: value === 'select' ? field.options || ['Option 1'] : undefined,
                          })
                        }
                        disabled={!canEdit}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Required</Label>
                      <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-3">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) => handleFieldChange(index, { required: e.target.checked })}
                          disabled={!canEdit}
                        />
                        <span className="text-sm text-gray-600">Required field</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Placeholder</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => handleFieldChange(index, { placeholder: e.target.value })}
                        placeholder="Optional helper"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <Label>Options (comma-separated)</Label>
                      <Input
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          handleFieldChange(index, {
                            options: e.target.value
                              .split(',')
                              .map((option) => option.trim())
                              .filter(Boolean),
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              disabled={loading || !canEdit}
            >
              {loading ? 'Saving...' : template ? 'Update template' : 'Create template'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
