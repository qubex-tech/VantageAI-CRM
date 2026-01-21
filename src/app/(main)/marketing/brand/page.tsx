'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle, AlertCircle, Palette } from 'lucide-react'
import Link from 'next/link'

type BrandProfile = {
  practiceName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  headerLayout: 'left' | 'center'
  emailFooterHtml: string
  smsFooterText: string
  defaultFromName: string
  defaultFromEmail: string
  defaultReplyToEmail: string
  defaultSmsSenderId: string
  quietHoursStart: string
  quietHoursEnd: string
  timezone: string
}

const defaultBrandProfile: BrandProfile = {
  practiceName: '',
  logoUrl: '',
  primaryColor: '#2563eb',
  secondaryColor: '#64748b',
  fontFamily: 'Arial',
  headerLayout: 'left',
  emailFooterHtml: '',
  smsFooterText: '',
  defaultFromName: '',
  defaultFromEmail: '',
  defaultReplyToEmail: '',
  defaultSmsSenderId: '',
  quietHoursStart: '',
  quietHoursEnd: '',
  timezone: '',
}

export default function BrandSettingsPage() {
  const [form, setForm] = useState<BrandProfile>(defaultBrandProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const loadBrandProfile = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/marketing/brand')
        if (!response.ok) {
          throw new Error('Failed to load brand settings')
        }
        const data = await response.json()
        if (data.brandProfile) {
          setForm({
            ...defaultBrandProfile,
            practiceName: data.brandProfile.practiceName || '',
            logoUrl: data.brandProfile.logoUrl || '',
            primaryColor: data.brandProfile.primaryColor || '#2563eb',
            secondaryColor: data.brandProfile.secondaryColor || '#64748b',
            fontFamily: data.brandProfile.fontFamily || 'Arial',
            headerLayout: data.brandProfile.headerLayout || 'left',
            emailFooterHtml: data.brandProfile.emailFooterHtml || '',
            smsFooterText: data.brandProfile.smsFooterText || '',
            defaultFromName: data.brandProfile.defaultFromName || '',
            defaultFromEmail: data.brandProfile.defaultFromEmail || '',
            defaultReplyToEmail: data.brandProfile.defaultReplyToEmail || '',
            defaultSmsSenderId: data.brandProfile.defaultSmsSenderId || '',
            quietHoursStart: data.brandProfile.quietHoursStart || '',
            quietHoursEnd: data.brandProfile.quietHoursEnd || '',
            timezone: data.brandProfile.timezone || '',
          })
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load brand settings')
      } finally {
        setLoading(false)
      }
    }

    loadBrandProfile()
  }, [])

  const handleChange = (key: keyof BrandProfile, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/marketing/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save brand settings')
      }

      setSuccess('Brand settings saved successfully.')
    } catch (err: any) {
      setError(err.message || 'Failed to save brand settings')
    } finally {
      setSaving(false)
    }
  }

  const previewStyles = useMemo(() => {
    return {
      fontFamily: form.fontFamily || 'Arial',
      color: form.primaryColor || '#2563eb',
      borderColor: form.secondaryColor || '#64748b',
    }
  }, [form.fontFamily, form.primaryColor, form.secondaryColor])

  if (loading) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading brand settings...
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Brand Settings</h1>
          <p className="text-sm text-gray-500">Configure brand identity and communication defaults</p>
        </div>
        <Link href="/marketing">
          <Button variant="outline">Back to Marketing</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Identity
              </CardTitle>
              <CardDescription>Logo, colors, and typography</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Practice Name *</Label>
                <Input
                  value={form.practiceName}
                  onChange={(e) => handleChange('practiceName', e.target.value)}
                  placeholder="Your practice name"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={form.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <Input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <Input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select value={form.fontFamily} onValueChange={(value) => handleChange('fontFamily', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Header Layout</Label>
                  <Select value={form.headerLayout} onValueChange={(value) => handleChange('headerLayout', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Defaults</CardTitle>
              <CardDescription>Sender information and email footer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default From Name *</Label>
                  <Input
                    value={form.defaultFromName}
                    onChange={(e) => handleChange('defaultFromName', e.target.value)}
                    placeholder="Practice name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default From Email *</Label>
                  <Input
                    value={form.defaultFromEmail}
                    onChange={(e) => handleChange('defaultFromEmail', e.target.value)}
                    placeholder="sender@practice.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reply-to Email</Label>
                <Input
                  value={form.defaultReplyToEmail}
                  onChange={(e) => handleChange('defaultReplyToEmail', e.target.value)}
                  placeholder="reply@practice.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Footer (HTML)</Label>
                <Textarea
                  value={form.emailFooterHtml}
                  onChange={(e) => handleChange('emailFooterHtml', e.target.value)}
                  placeholder="<p>Address, phone, and unsubscribe link</p>"
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS Defaults</CardTitle>
              <CardDescription>Sender ID and SMS footer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default SMS Sender ID</Label>
                <Input
                  value={form.defaultSmsSenderId}
                  onChange={(e) => handleChange('defaultSmsSenderId', e.target.value)}
                  placeholder="e.g., PRACTICE"
                />
                <p className="text-xs text-gray-500">May require approval depending on provider.</p>
              </div>
              <div className="space-y-2">
                <Label>SMS Footer</Label>
                <Textarea
                  value={form.smsFooterText}
                  onChange={(e) => handleChange('smsFooterText', e.target.value)}
                  placeholder="Reply STOP to opt out."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>Limit sending during preferred time window</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => handleChange('quietHoursStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  placeholder="e.g., America/New_York"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Preview</CardTitle>
              <CardDescription>Quick look at your styling</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-gray-200 rounded-lg p-4" style={previewStyles}>
                <div className={`flex items-center ${form.headerLayout === 'center' ? 'justify-center' : 'justify-start'} gap-3 mb-4`}>
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="h-10" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-200" />
                  )}
                  <span className="font-semibold text-gray-900">{form.practiceName || 'Practice Name'}</span>
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  This is a preview of your email header and typography.
                </div>
                <Button style={{ backgroundColor: form.primaryColor }} className="text-white w-full">
                  Primary Button
                </Button>
                <div className="text-xs text-gray-500 mt-3">
                  Secondary color: <span className="font-medium">{form.secondaryColor || '#64748b'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save Changes</CardTitle>
              <CardDescription>Apply settings across marketing templates</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Brand Settings'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
