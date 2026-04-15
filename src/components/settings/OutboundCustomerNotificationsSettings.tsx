'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface OutboundCustomerNotificationsSettingsProps {
  practiceId: string
  resendConfigured: boolean
}

export function OutboundCustomerNotificationsSettings({
  practiceId,
  resendConfigured,
}: OutboundCustomerNotificationsSettingsProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [notifyUnsuccessfulTransfer, setNotifyUnsuccessfulTransfer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `/api/settings/outbound-customer-notifications?practiceId=${encodeURIComponent(practiceId)}`
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load notification settings')
        }
        const data = await res.json()
        const s = data.settings as { recipientEmail?: string | null; notifyUnsuccessfulTransfer?: boolean }
        if (!cancelled) {
          setRecipientEmail(s.recipientEmail ?? '')
          setNotifyUnsuccessfulTransfer(Boolean(s.notifyUnsuccessfulTransfer))
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load')
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const res = await fetch(
        `/api/settings/outbound-customer-notifications?practiceId=${encodeURIComponent(practiceId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: recipientEmail.trim() || null,
            notifyUnsuccessfulTransfer,
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      setSuccess('Notification settings saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outbound Customer Notifications</CardTitle>
        <CardDescription>
          Email your team when the voice agent reports certain outcomes from Retell post-call analysis. Delivery uses
          this practice&apos;s Resend integration (configured above).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {!resendConfigured && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                Resend is not configured for this practice. Add a Resend API key and verified sender above before
                notifications can be delivered.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="outbound-notification-email">Notification inbox email</Label>
              <Input
                id="outbound-notification-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="frontdesk@example.com"
                autoComplete="email"
              />
              <p className="text-xs text-gray-500">
                Where to send staff alerts (separate from the Resend &quot;from&quot; address).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="notify-unsuccessful-transfer">Unsuccessful transfer</Label>
                <p className="text-sm text-gray-500">
                  Send an email when Retell analysis marks the transfer outcome as &quot;not successful&quot;,
                  including the caller&apos;s voicemail message when present.
                </p>
              </div>
              <Switch
                id="notify-unsuccessful-transfer"
                checked={notifyUnsuccessfulTransfer}
                onCheckedChange={setNotifyUnsuccessfulTransfer}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{error}</div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">
                {success}
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save notification settings'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
