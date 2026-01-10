'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Save, 
  Send, 
  Eye, 
  Copy, 
  Archive, 
  Mail, 
  MessageSquare, 
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import EmailBuilder from './EmailBuilder'

// Client-safe SMS stats calculation
function calculateSmsStats(text: string): { characterCount: number; segments: number; encoding: 'GSM-7' | 'Unicode' } {
  const chars = text.length
  
  // Simple check: if text contains non-GSM-7 characters, assume Unicode
  const gsm7Pattern = /^[\x00-\x7F]*$/
  const hasUnicode = !gsm7Pattern.test(text) || /[^\x20-\x7E\x09\x0A\x0D]/.test(text)
  
  const encoding = hasUnicode ? 'Unicode' : 'GSM-7'
  const charsPerSegment = hasUnicode ? 70 : 160
  
  // Account for concatenation (messages over 1 segment need 6 extra chars for UDH)
  let segments = 1
  let remaining = chars
  
  while (remaining > charsPerSegment) {
    segments++
    remaining -= charsPerSegment
    if (segments > 1) {
      remaining -= 6 // UDH overhead for concatenated messages
    }
  }
  
  return { characterCount: chars, segments, encoding }
}

// Client-safe variable extraction
function extractVariables(text: string): string[] {
  const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g
  const variables: string[] = []
  const matches = text.matchAll(VARIABLE_PATTERN)
  
  for (const match of matches) {
    const varKey = match[1].trim()
    if (varKey && !variables.includes(varKey)) {
      variables.push(varKey)
    }
  }
  
  return variables
}

interface TemplateEditorProps {
  template: {
    id: string
    channel: 'email' | 'sms'
    name: string
    category: string
    status: 'draft' | 'published' | 'archived'
    editorType: 'dragdrop' | 'html' | 'plaintext'
    subject?: string | null
    preheader?: string | null
    bodyJson?: any
    bodyHtml?: string | null
    bodyText?: string | null
    variablesUsed?: any
    lastPublishedAt?: Date | null
    updatedAt: Date
    createdAt: Date
    createdBy: {
      id: string
      name: string
      email: string
    }
    versions: Array<{
      id: string
      versionNumber: number
      createdAt: Date
      createdBy: {
        id: string
        name: string
        email: string
      }
    }>
  }
  brandProfile: any
  userId: string
}

export default function TemplateEditor({ template: initialTemplate, brandProfile, userId }: TemplateEditorProps) {
  const router = useRouter()
  const [template, setTemplate] = useState(initialTemplate)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ html?: string; text?: string; subject?: string } | null>(null)
  const [lintResult, setLintResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'test'>('editor')
  
  // Form state
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject || '')
  const [preheader, setPreheader] = useState(template.preheader || '')
  const [bodyText, setBodyText] = useState(template.bodyText || '')
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml || '')
  const [editorType, setEditorType] = useState(template.editorType)

  // For email templates - simple HTML editor for now
  // For SMS templates - plain text editor with variable picker

  useEffect(() => {
    // Extract variables from content when it changes
    if (template.channel === 'sms' && bodyText) {
      const vars = extractVariables(bodyText)
      // Variables extracted for display/validation
    } else if (template.channel === 'email' && (bodyHtml || bodyText)) {
      const vars = extractVariables(bodyHtml || bodyText)
      // Variables extracted for display/validation
    }
  }, [bodyText, bodyHtml, template.channel])

  const handleSave = async () => {
    setError('')
    setSaving(true)

    try {
      const data: any = {
        name,
        subject: template.channel === 'email' ? subject : null,
        preheader: template.channel === 'email' ? preheader : null,
        editorType,
      }

      if (template.channel === 'sms') {
        data.bodyText = bodyText
        data.bodyHtml = null
        data.bodyJson = null
      } else {
        // Email template
        if (editorType === 'html') {
          data.bodyHtml = bodyHtml
          data.bodyJson = null
        } else {
          // Drag-drop mode - keep existing bodyJson or initialize
          data.bodyJson = template.bodyJson || { rows: [] }
        }
        data.bodyText = null
      }

      // Extract variables from content
      const content = template.channel === 'sms' ? bodyText : (bodyHtml || JSON.stringify(data.bodyJson || {}))
      const subjectContent = template.channel === 'email' ? subject : ''
      const allContent = content + ' ' + subjectContent
      const variablesUsed = extractVariables(allContent)
      // Deduplicate variables
      const uniqueVars: string[] = []
      for (const v of variablesUsed) {
        if (!uniqueVars.includes(v)) {
          uniqueVars.push(v)
        }
      }
      data.variablesUsed = uniqueVars

      const response = await fetch(`/api/marketing/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save template')
      }

      const { template: updated } = await response.json()
      setTemplate(updated)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/marketing/templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleContext: {
            patient: { firstName: 'John', lastName: 'Doe' },
            practice: { name: brandProfile?.practiceName || 'Practice', phone: '+1-555-0100' },
            appointment: { date: 'January 15, 2024', time: '2:00 PM', location: 'Main Office', providerName: 'Dr. Smith' },
            links: { confirm: 'https://example.com/confirm', reschedule: 'https://example.com/reschedule', cancel: 'https://example.com/cancel' },
          },
        }),
      })

      const data = await response.json()
      setPreview({
        html: data.html,
        text: data.text,
        subject: data.subject,
      })
      setLintResult(data.lintResult)
      setActiveTab('preview')
    } catch (err: any) {
      setError(err.message || 'Failed to preview template')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!confirm('Publish this template? It will be available for use in campaigns.')) return

    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/marketing/templates/${template.id}/publish`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.lintResult && !errorData.lintResult.isValid) {
          setLintResult(errorData.lintResult)
          setError('Template validation failed. Please fix the errors below.')
          setActiveTab('editor')
          return
        }
        throw new Error(errorData.error || 'Failed to publish template')
      }

      const { template: updated } = await response.json()
      setTemplate(updated)
      router.refresh()
      alert('Template published successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to publish template')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/marketing/templates/${template.id}/duplicate`, {
        method: 'POST',
      })
      if (response.ok) {
        const { template: duplicate } = await response.json()
        router.push(`/marketing/templates/${duplicate.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate template')
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!confirm('Archive this template? It will no longer be available for use.')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/marketing/templates/${template.id}/archive`, {
        method: 'POST',
      })
      if (response.ok) {
        router.push('/marketing/templates')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to archive template')
    } finally {
      setLoading(false)
    }
  }

  // SMS stats
  const smsStats = template.channel === 'sms' && bodyText ? calculateSmsStats(bodyText) : null

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/marketing/templates" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ChevronLeft className="h-4 w-4" />
          Back to Templates
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {template.channel === 'email' ? (
                <Mail className="h-5 w-5 text-gray-400" />
              ) : (
                <MessageSquare className="h-5 w-5 text-gray-400" />
              )}
              <h1 className="text-2xl font-semibold text-gray-900">{name}</h1>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                template.status === 'published' 
                  ? 'bg-green-100 text-green-700' 
                  : template.status === 'archived'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {template.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {template.category} • Updated {new Date(template.updatedAt).toLocaleDateString()}
              {template.lastPublishedAt && ` • Published ${new Date(template.lastPublishedAt).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={loading}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
            {template.status !== 'archived' && (
              <Button variant="outline" size="sm" onClick={handleArchive} disabled={loading}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            )}
            {template.status === 'draft' && (
              <Button size="sm" onClick={handlePublish} disabled={loading || saving}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Publish
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lint Results */}
      {lintResult && lintResult.errors && lintResult.errors.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm text-red-700">Validation Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-red-700">
              {lintResult.errors.map((err: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>{err.field}:</strong> {err.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {lintResult && lintResult.warnings && lintResult.warnings.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-700">Validation Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-yellow-700">
              {lintResult.warnings.map((warn: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>{warn.field}:</strong> {warn.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mb-6">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
              <CardDescription>Basic information for your template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Appointment Reminder"
                />
              </div>

              {template.channel === 'email' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject line"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preheader">Preheader</Label>
                    <Input
                      id="preheader"
                      value={preheader}
                      onChange={(e) => setPreheader(e.target.value)}
                      placeholder="Preview text (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editorType">Editor Type</Label>
                    <Select value={editorType} onValueChange={(v: any) => setEditorType(v)}>
                      <SelectTrigger id="editorType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML Editor</SelectItem>
                        <SelectItem value="dragdrop">Drag & Drop Builder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {template.channel === 'email' && editorType === 'html' && (
                <div className="space-y-2">
                  <Label htmlFor="bodyHtml">Email Body (HTML) *</Label>
                  <Textarea
                    id="bodyHtml"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="Enter HTML content. Use {{variable}} syntax for personalization."
                    rows={20}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Use HTML markup. Variables: {`{{patient.firstName}}`}, {`{{appointment.date}}`}, etc.
                  </p>
                </div>
              )}

              {template.channel === 'email' && editorType === 'dragdrop' && (
                <div className="space-y-4">
                  <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
                    <EmailBuilder
                      initialDoc={(template.bodyJson as any) || { rows: [], globalStyles: {} }}
                      brandProfile={brandProfile}
                      onSave={async (doc) => {
                        // Save the bodyJson document
                        setError('')
                        setSaving(true)
                        try {
                          const response = await fetch(`/api/marketing/templates/${template.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name,
                              subject,
                              preheader,
                              editorType: 'dragdrop',
                              bodyJson: doc,
                              bodyHtml: null,
                              bodyText: null,
                            }),
                          })

                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || 'Failed to save template')
                          }

                          const { template: updated } = await response.json()
                          setTemplate(updated)
                          router.refresh()
                        } catch (err: any) {
                          setError(err.message || 'Failed to save template')
                        } finally {
                          setSaving(false)
                        }
                      }}
                      onPreview={handlePreview}
                      saving={saving}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorType('html')}
                  >
                    Switch to HTML Editor
                  </Button>
                </div>
              )}

              {template.channel === 'sms' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bodyText">Message Text *</Label>
                    <Textarea
                      id="bodyText"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Enter SMS message. Use {{variable}} syntax for personalization."
                      rows={8}
                    />
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                      <span>
                        Characters: {bodyText.length}
                        {smsStats && ` • Segments: ${smsStats.segments} • Encoding: ${smsStats.encoding}`}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-xs"
                          onClick={() => setBodyText(bodyText + '{{patient.firstName}}')}
                        >
                          Insert: patient.firstName
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-xs"
                          onClick={() => setBodyText(bodyText + '{{appointment.date}}')}
                        >
                          Insert: appointment.date
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-xs"
                          onClick={() => setBodyText(bodyText + '{{practice.name}}')}
                        >
                          Insert: practice.name
                        </Button>
                      </div>
                    </div>
                  </div>
                  {smsStats && smsStats.segments > 1 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      This message will be sent as {smsStats.segments} segment(s), which may increase cost.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={loading || saving}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How your template will look to recipients</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                  <p className="text-sm text-gray-500">Generating preview...</p>
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {template.channel === 'email' && preview.html && (
                    <>
                      {preview.subject && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Subject:</p>
                          <p className="font-medium">{preview.subject}</p>
                        </div>
                      )}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <iframe
                          srcDoc={preview.html}
                          className="w-full h-[600px] border-0"
                          title="Email Preview"
                        />
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Plain Text Version:</p>
                        <pre className="text-xs whitespace-pre-wrap font-mono">{preview.text}</pre>
                      </div>
                    </>
                  )}
                  {template.channel === 'sms' && preview.text && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">SMS Preview:</p>
                      <pre className="text-sm whitespace-pre-wrap font-mono">{preview.text}</pre>
                      {smsStats && (
                        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                          <p>Characters: {smsStats.characterCount}</p>
                          <p>Segments: {smsStats.segments}</p>
                          <p>Encoding: {smsStats.encoding}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 mb-4">No preview available</p>
                  <Button variant="outline" onClick={handlePreview}>
                    <Eye className="h-4 w-4 mr-2" />
                    Generate Preview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Send Test</CardTitle>
              <CardDescription>Send a test email or SMS to verify your template</CardDescription>
            </CardHeader>
            <CardContent>
              <TestSendForm templateId={template.id} channel={template.channel} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Test Send Form Component
function TestSendForm({ templateId, channel }: { templateId: string; channel: 'email' | 'sms' }) {
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const endpoint = channel === 'email' 
        ? `/api/marketing/templates/${templateId}/test-send/email`
        : `/api/marketing/templates/${templateId}/test-send/sms`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destination,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if this is a configuration error
        if (data.requiresConfiguration) {
          throw new Error(data.error || 'SendGrid integration is not configured')
        }
        throw new Error(data.error || 'Failed to send test message')
      }

      setSuccess(true)
      setDestination('')
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to send test message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleTestSend} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="destination">
          {channel === 'email' ? 'Email Address' : 'Phone Number'} *
        </Label>
        <Input
          id="destination"
          type={channel === 'email' ? 'email' : 'tel'}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={channel === 'email' ? 'test@example.com' : '+1-555-0100'}
          required
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-2">
          <div className="font-medium">Failed to send test message</div>
          <div>{error}</div>
          {error.includes('SendGrid integration') && (
            <div className="mt-2 text-xs">
              <p>To send emails, please configure SendGrid:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Go to Settings → SendGrid Integration</li>
                <li>Enter your SendGrid API key</li>
                <li>Verify your sender email address in SendGrid</li>
                <li>Test the connection</li>
              </ol>
            </div>
          )}
          {error.includes('sender') && (
            <div className="mt-2 text-xs">
              The sender email address must be verified in SendGrid. Please verify it in your SendGrid account or update it in Settings.
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <div className="font-medium">Test {channel === 'email' ? 'email' : 'SMS'} sent successfully!</div>
          {channel === 'email' && (
            <div className="mt-1 text-xs text-green-600">
              Check your inbox (and spam folder) for the test email. If you don't receive it, verify your sender email in SendGrid.
            </div>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading || !destination}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send Test {channel === 'email' ? 'Email' : 'SMS'}
          </>
        )}
      </Button>
    </form>
  )
}
