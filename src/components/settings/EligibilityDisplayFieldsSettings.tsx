'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import {
  ELIGIBILITY_DISPLAY_CATALOG,
  ELIGIBILITY_DISPLAY_FIELD_IDS,
  parseDisplayFieldsConfig,
  type EligibilityDisplayFieldId,
  type EligibilityDisplayFieldsConfig,
} from '@/lib/eligibility/display-fields'

interface EligibilityDisplayFieldsSettingsProps {
  practiceId?: string
}

function emptyConfig(): EligibilityDisplayFieldsConfig {
  return {
    fields: ELIGIBILITY_DISPLAY_FIELD_IDS.map((id) => ({ id, crm: false, ehr: false })),
  }
}

export function EligibilityDisplayFieldsSettings({
  practiceId,
}: EligibilityDisplayFieldsSettingsProps) {
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }

  const [config, setConfig] = useState<EligibilityDisplayFieldsConfig>(emptyConfig())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(apiUrl('/api/settings/eligibility'))
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load eligibility fields')
        }
        if (cancelled) return
        setConfig(parseDisplayFieldsConfig(data.settings?.displayFields) || emptyConfig())
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load eligibility fields')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [practiceId])

  function toggle(id: EligibilityDisplayFieldId, key: 'crm' | 'ehr', value: boolean) {
    setSaved(false)
    setConfig((current) => ({
      fields: current.fields.map((field) =>
        field.id === id ? { ...field, [key]: value } : field
      ),
    }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(apiUrl('/api/settings/eligibility'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          displayFields: config,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save eligibility fields')
      }
      setConfig(parseDisplayFieldsConfig(data.settings?.displayFields) || config)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save eligibility fields')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Benefits to capture
        </CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Choose what this practice sees after an eligibility check, and what we write into the
          chart. Missing answers show as Unknown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading benefit fields…
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5">Benefit</th>
                    <th className="w-36 px-4 py-2.5 text-center">Show in Vantage</th>
                    <th className="w-40 px-4 py-2.5 text-center">Write to the chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {ELIGIBILITY_DISPLAY_CATALOG.map((field) => {
                    const row = config.fields.find((item) => item.id === field.id) || {
                      id: field.id,
                      crm: false,
                      ehr: false,
                    }
                    return (
                      <tr key={field.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{field.label}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{field.description}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={row.crm}
                            onCheckedChange={(checked) => toggle(field.id, 'crm', checked)}
                            aria-label={`Show ${field.label} in Vantage`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={row.ehr}
                            onCheckedChange={(checked) => toggle(field.id, 'ehr', checked)}
                            aria-label={`Write ${field.label} to the chart`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {saved && !error && (
              <p className="text-sm text-green-700">Benefit fields saved.</p>
            )}

            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save benefit fields'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
