'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CommunicationIntegrationPlatform = 'none' | 'curogram' | 'weave' | 'us_telekom'

interface CommunicationsSettingsProps {
  practiceId?: string
  initialRetellIntegration?: {
    hasApiKey?: boolean
    apiKey?: string | null
    curogramEscalationEnabled?: boolean
    curogramEscalationUrl?: string | null
  } | null
}

export function CommunicationsSettings({
  practiceId,
  initialRetellIntegration,
}: CommunicationsSettingsProps) {
  const [platform, setPlatform] = useState<CommunicationIntegrationPlatform>('none')
  const [curogramEscalationEnabled, setCurogramEscalationEnabled] = useState(
    Boolean(initialRetellIntegration?.curogramEscalationEnabled)
  )
  const [curogramEscalationUrl, setCurogramEscalationUrl] = useState(
    initialRetellIntegration?.curogramEscalationUrl || ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const hasRetellApiKey = Boolean(initialRetellIntegration?.hasApiKey || initialRetellIntegration?.apiKey)

  const apiUrl = useMemo(() => {
    const base = '/api/settings/communications'
    if (!practiceId) return base
    return `${base}?practiceId=${encodeURIComponent(practiceId)}`
  }, [practiceId])

  const retellUrl = useMemo(() => {
    const base = '/api/settings/retell'
    if (!practiceId) return base
    return `${base}?practiceId=${encodeURIComponent(practiceId)}`
  }, [practiceId])

  useEffect(() => {
    setCurogramEscalationEnabled(Boolean(initialRetellIntegration?.curogramEscalationEnabled))
    setCurogramEscalationUrl(initialRetellIntegration?.curogramEscalationUrl || '')
  }, [initialRetellIntegration])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const response = await fetch(apiUrl)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Failed to load communications settings')
        if (!isMounted) return
        const nextPlatform = payload?.settings?.platform
        if (
          nextPlatform === 'none' ||
          nextPlatform === 'curogram' ||
          nextPlatform === 'weave' ||
          nextPlatform === 'us_telekom'
        ) {
          setPlatform(nextPlatform)
        } else {
          setPlatform('none')
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Failed to load communications settings')
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [apiUrl])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const communicationsResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          settings: { platform },
        }),
      })
      const communicationsPayload = await communicationsResponse.json().catch(() => ({}))
      if (!communicationsResponse.ok) {
        throw new Error(communicationsPayload.error || 'Failed to save communications platform')
      }

      if (platform === 'curogram') {
        const retellResponse = await fetch(retellUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            curogramEscalationEnabled,
            curogramEscalationUrl: curogramEscalationUrl || undefined,
          }),
        })
        const retellPayload = await retellResponse.json().catch(() => ({}))
        if (!retellResponse.ok) {
          throw new Error(
            retellPayload.error ||
              'Failed to save Curogram settings. Ensure Retell API key is configured first.'
          )
        }
      }

      setSuccess('Communications settings saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save communications settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Communications</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Configure outbound communication integration platform and Curogram escalation settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="communication-platform" className="text-sm font-medium text-gray-700">
              Communication Integration Platform
            </Label>
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as CommunicationIntegrationPlatform)}
            >
              <SelectTrigger id="communication-platform">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="curogram">Curogram</SelectItem>
                <SelectItem value="weave">Weave</SelectItem>
                <SelectItem value="us_telekom">US Telekom</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              This controls which outbound communication platform the practice is configured to use.
            </p>
          </div>

          {platform === 'curogram' && (
            <div className="space-y-3 rounded-md border border-gray-200 p-4">
              {!hasRetellApiKey && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Retell API key must be configured first before Curogram escalation settings can be saved.
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  id="curogramEscalationEnabled"
                  type="checkbox"
                  checked={curogramEscalationEnabled}
                  onChange={(e) => setCurogramEscalationEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                />
                <Label htmlFor="curogramEscalationEnabled" className="text-sm font-medium text-gray-700">
                  Enable Curogram AI Escalation to Text
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="curogramEscalationUrl" className="text-sm font-medium text-gray-700">
                  Curogram Escalation URL
                </Label>
                <Input
                  id="curogramEscalationUrl"
                  type="url"
                  value={curogramEscalationUrl}
                  onChange={(e) => setCurogramEscalationUrl(e.target.value)}
                  placeholder="https://voip.curogram.com/ai-escalation-to-text/<practice-guid>"
                  required={curogramEscalationEnabled}
                />
              </div>
            </div>
          )}

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">{success}</div>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Communications Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
