'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { HealixPreChartTemplate, PreVisitChartType, PreVisitTemplateSection } from '@/lib/previsit/types'

interface PreChartTemplateSettingsProps {
  practiceId?: string
}

const EMPTY_TEMPLATE: HealixPreChartTemplate = {
  formatStyle: 'custom',
  formattingPreferences: {
    includeBulletPoints: true,
    includeICDHints: false,
    includeMedicationTable: false,
    maxSectionLength: 1200,
  },
  variants: {
    new_patient: { label: 'New Patient', sections: [], smartPhrases: [] },
    follow_up: { label: 'Follow-Up', sections: [], smartPhrases: [] },
  },
}

function buildApiUrl(practiceId?: string) {
  const base = '/api/settings/ai/pre-chart-template'
  if (!practiceId) return base
  return `${base}?practiceId=${encodeURIComponent(practiceId)}`
}

export function PreChartTemplateSettings({ practiceId }: PreChartTemplateSettingsProps) {
  const [template, setTemplate] = useState<HealixPreChartTemplate>(EMPTY_TEMPLATE)
  const [activeVariant, setActiveVariant] = useState<PreVisitChartType>('new_patient')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const apiUrl = useMemo(() => buildApiUrl(practiceId), [practiceId])

  const loadTemplate = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(apiUrl)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load template')
      }
      setTemplate(data.template || EMPTY_TEMPLATE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplate()
  }, [apiUrl])

  const updateVariant = (variant: PreVisitChartType, updater: (value: HealixPreChartTemplate['variants'][PreVisitChartType]) => HealixPreChartTemplate['variants'][PreVisitChartType]) => {
    setTemplate((prev) => ({
      ...prev,
      variants: {
        ...prev.variants,
        [variant]: updater(prev.variants[variant]),
      },
    }))
  }

  const updateSection = (variant: PreVisitChartType, sectionIndex: number, patch: Partial<PreVisitTemplateSection>) => {
    updateVariant(variant, (current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex ? { ...section, ...patch } : section
      ),
    }))
  }

  const addSection = (variant: PreVisitChartType) => {
    updateVariant(variant, (current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: `section_${Date.now()}`,
          title: 'New Section',
          guidance: '',
          required: false,
        },
      ],
    }))
  }

  const removeSection = (variant: PreVisitChartType, sectionIndex: number) => {
    updateVariant(variant, (current) => ({
      ...current,
      sections: current.sections.filter((_, index) => index !== sectionIndex),
    }))
  }

  const moveSection = (variant: PreVisitChartType, sectionIndex: number, direction: 'up' | 'down') => {
    updateVariant(variant, (current) => {
      const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1
      if (targetIndex < 0 || targetIndex >= current.sections.length) return current
      const next = [...current.sections]
      const [item] = next.splice(sectionIndex, 1)
      next.splice(targetIndex, 0, item)
      return { ...current, sections: next }
    })
  }

  const updateSmartPhrases = (variant: PreVisitChartType, value: string) => {
    updateVariant(variant, (current) => ({
      ...current,
      smartPhrases: value
        .split('\n')
        .map((phrase) => phrase.trim())
        .filter(Boolean),
    }))
  }

  const saveTemplate = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template')
      }
      setTemplate(data.template || template)
      setSuccess('Pre-chart template saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pre-Chart Template</CardTitle>
          <CardDescription>Loading template settings...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const currentVariant = template.variants[activeVariant]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-Chart Template</CardTitle>
        <CardDescription>
          Configure practice-specific pre-visit chart structure, required sections, and smart phrases.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="format-style">Format style</Label>
            <Input
              id="format-style"
              value={template.formatStyle || 'custom'}
              onChange={(e) => setTemplate((prev) => ({ ...prev, formatStyle: e.target.value as HealixPreChartTemplate['formatStyle'] }))}
              placeholder="custom"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-section-length">Max section length (chars)</Label>
            <Input
              id="max-section-length"
              type="number"
              value={template.formattingPreferences?.maxSectionLength ?? 1200}
              onChange={(e) =>
                setTemplate((prev) => ({
                  ...prev,
                  formattingPreferences: {
                    ...prev.formattingPreferences,
                    maxSectionLength: Number(e.target.value) || undefined,
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Bulleted summaries</Label>
            <Switch
              checked={template.formattingPreferences?.includeBulletPoints ?? true}
              onCheckedChange={(checked) =>
                setTemplate((prev) => ({
                  ...prev,
                  formattingPreferences: {
                    ...prev.formattingPreferences,
                    includeBulletPoints: checked,
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Include ICD hints</Label>
            <Switch
              checked={template.formattingPreferences?.includeICDHints ?? false}
              onCheckedChange={(checked) =>
                setTemplate((prev) => ({
                  ...prev,
                  formattingPreferences: {
                    ...prev.formattingPreferences,
                    includeICDHints: checked,
                  },
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Medication table</Label>
            <Switch
              checked={template.formattingPreferences?.includeMedicationTable ?? false}
              onCheckedChange={(checked) =>
                setTemplate((prev) => ({
                  ...prev,
                  formattingPreferences: {
                    ...prev.formattingPreferences,
                    includeMedicationTable: checked,
                  },
                }))
              }
            />
          </div>
        </div>

        <Tabs value={activeVariant} onValueChange={(value) => setActiveVariant(value as PreVisitChartType)}>
          <TabsList>
            <TabsTrigger value="new_patient">New Patient</TabsTrigger>
            <TabsTrigger value="follow_up">Follow-up</TabsTrigger>
          </TabsList>

          <TabsContent value={activeVariant} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Variant label</Label>
              <Input
                value={currentVariant.label}
                onChange={(e) => updateVariant(activeVariant, (current) => ({ ...current, label: e.target.value }))}
                placeholder="Variant label"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sections (ordered)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addSection(activeVariant)}>
                  Add Section
                </Button>
              </div>
              <div className="space-y-3">
                {currentVariant.sections.map((section, index) => (
                  <div key={`${section.id}-${index}`} className="rounded-md border p-3 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Section ID</Label>
                        <Input
                          value={section.id}
                          onChange={(e) => updateSection(activeVariant, index, { id: e.target.value })}
                          placeholder="section_id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Section title</Label>
                        <Input
                          value={section.title}
                          onChange={(e) => updateSection(activeVariant, index, { title: e.target.value })}
                          placeholder="Section title"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Guidance</Label>
                      <Input
                        value={section.guidance || ''}
                        onChange={(e) => updateSection(activeVariant, index, { guidance: e.target.value })}
                        placeholder="Instruction for Healix generation"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!section.required}
                          onCheckedChange={(checked) => updateSection(activeVariant, index, { required: checked })}
                        />
                        <Label>Required section</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => moveSection(activeVariant, index, 'up')} disabled={index === 0}>
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => moveSection(activeVariant, index, 'down')}
                          disabled={index === currentVariant.sections.length - 1}
                        >
                          Down
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => removeSection(activeVariant, index)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`smart-phrases-${activeVariant}`}>Smart phrases (one per line)</Label>
              <Textarea
                id={`smart-phrases-${activeVariant}`}
                value={currentVariant.smartPhrases.join('\n')}
                onChange={(e) => updateSmartPhrases(activeVariant, e.target.value)}
                placeholder=".hpi.default\n.followup.template"
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>
        </Tabs>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        {success ? <div className="text-sm text-green-600">{success}</div> : null}

        <div className="flex items-center gap-2">
          <Button type="button" onClick={saveTemplate} disabled={saving}>
            {saving ? 'Saving...' : 'Save Pre-Chart Template'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadTemplate()} disabled={loading}>
            Reload
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
