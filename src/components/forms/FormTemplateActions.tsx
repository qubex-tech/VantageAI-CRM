'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface FormTemplateActionsProps {
  template: {
    id: string
    name: string
    description?: string | null
    category: string
    schema: unknown
    isSystem?: boolean
  }
}

export function FormTemplateActions({ template }: FormTemplateActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!template.isSystem) {
    return null
  }

  const handleDuplicate = async () => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/forms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          description: template.description,
          category: template.category,
          schema: template.schema,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to duplicate template')
      }

      const data = await response.json()
      router.push(`/forms/templates/${data.template.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
          {error}
        </div>
      )}
      <Button variant="outline" onClick={handleDuplicate} disabled={loading}>
        {loading ? 'Duplicating...' : 'Duplicate template'}
      </Button>
    </div>
  )
}
