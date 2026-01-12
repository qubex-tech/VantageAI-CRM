'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface Preferences {
  preferredChannel: string
  smsEnabled: boolean
  emailEnabled: boolean
  voiceEnabled: boolean
  portalEnabled: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
}

interface PreferencesFormProps {
  initialPreferences: Preferences | null
}

export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    preferredChannel: initialPreferences?.preferredChannel || 'email',
    smsEnabled: initialPreferences?.smsEnabled ?? true,
    emailEnabled: initialPreferences?.emailEnabled ?? true,
    voiceEnabled: initialPreferences?.voiceEnabled ?? false,
    portalEnabled: initialPreferences?.portalEnabled ?? true,
    quietHoursStart: initialPreferences?.quietHoursStart || null,
    quietHoursEnd: initialPreferences?.quietHoursEnd || null,
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (initialPreferences) {
      setPreferences({
        preferredChannel: initialPreferences.preferredChannel || 'email',
        smsEnabled: initialPreferences.smsEnabled ?? true,
        emailEnabled: initialPreferences.emailEnabled ?? true,
        voiceEnabled: initialPreferences.voiceEnabled ?? false,
        portalEnabled: initialPreferences.portalEnabled ?? true,
        quietHoursStart: initialPreferences.quietHoursStart || null,
        quietHoursEnd: initialPreferences.quietHoursEnd || null,
      })
    }
  }, [initialPreferences])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/portal/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredChannel: preferences.preferredChannel,
          smsEnabled: preferences.smsEnabled,
          emailEnabled: preferences.emailEnabled,
          voiceEnabled: preferences.voiceEnabled,
          portalEnabled: preferences.portalEnabled,
          quietHoursStart: preferences.quietHoursStart || undefined,
          quietHoursEnd: preferences.quietHoursEnd || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update preferences')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preferred Contact Method */}
      <div>
        <Label htmlFor="preferredChannel" className="text-sm font-medium text-gray-700 mb-2 block">
          Preferred Contact Method
        </Label>
        <Select
          value={preferences.preferredChannel}
          onValueChange={(value) => setPreferences({ ...preferences, preferredChannel: value })}
        >
          <SelectTrigger id="preferredChannel" className="w-full md:w-64">
            <SelectValue placeholder="Select preferred method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="voice">Voice</SelectItem>
            <SelectItem value="portal">Portal</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Choose how you'd prefer to receive communications from the practice
        </p>
      </div>

      {/* Communication Channel Toggles */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-gray-700 block">
          Communication Channels
        </Label>
        
        <div className="space-y-4">
          {/* Email */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="emailEnabled" className="text-sm font-medium text-gray-900">
                Email
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Receive emails from the practice
              </p>
            </div>
            <Switch
              id="emailEnabled"
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, emailEnabled: checked })
              }
            />
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="smsEnabled" className="text-sm font-medium text-gray-900">
                SMS (Text Messages)
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Receive text messages from the practice
              </p>
            </div>
            <Switch
              id="smsEnabled"
              checked={preferences.smsEnabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, smsEnabled: checked })
              }
            />
          </div>

          {/* Voice */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="voiceEnabled" className="text-sm font-medium text-gray-900">
                Voice Calls
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Receive phone calls from the practice
              </p>
            </div>
            <Switch
              id="voiceEnabled"
              checked={preferences.voiceEnabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, voiceEnabled: checked })
              }
            />
          </div>

          {/* Portal */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="portalEnabled" className="text-sm font-medium text-gray-900">
                Portal Messages
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Receive messages through the patient portal
              </p>
            </div>
            <Switch
              id="portalEnabled"
              checked={preferences.portalEnabled}
              onCheckedChange={(checked) => 
                setPreferences({ ...preferences, portalEnabled: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">Preferences updated successfully!</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button
          type="submit"
          disabled={loading}
          className="bg-gray-900 hover:bg-gray-800 text-white"
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </form>
  )
}
