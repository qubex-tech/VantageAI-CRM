'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Loader2,
  X,
  Monitor,
  Smartphone,
  Clock,
  Undo2,
  Redo2
} from 'lucide-react'
import Link from 'next/link'
import EmailBuilder, { EmailBuilderRef } from './EmailBuilder'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
  const [showPreview, setShowPreview] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const emailBuilderRef = useRef<EmailBuilderRef | null>(null)
  
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

  useEffect(() => {
    if (template.channel === 'sms' && editorType !== 'plaintext') {
      setEditorType('plaintext')
    }
  }, [template.channel, editorType])

  const handleSave = async () => {
    setError('')
    setSaving(true)

    try {
      const data: any = {
        name,
        subject: template.channel === 'email' ? subject : null,
        preheader: template.channel === 'email' ? preheader : null,
        editorType: template.channel === 'sms' ? 'plaintext' : editorType,
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
      setLastSaved(new Date())
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }
  
  // Auto-save template details (name, subject, preheader) when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (name !== template.name || subject !== template.subject || preheader !== template.preheader) {
        // Only auto-save if values have actually changed
        const needsSave = name !== template.name || 
                         subject !== (template.subject || '') || 
                         preheader !== (template.preheader || '')
        if (needsSave && !saving) {
          handleSave()
        }
      }
    }, 2000) // Debounce auto-save - 2 seconds
    
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subject, preheader])

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
      setShowPreview(true)
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
          return
        }
        throw new Error(errorData.error || 'Failed to publish template')
      }

      const { template: updated } = await response.json()
      setTemplate(updated)
      setLastSaved(new Date())
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

  // Calculate time since last save
  const getTimeSinceSave = () => {
    if (!lastSaved && template.updatedAt) {
      const updated = new Date(template.updatedAt)
      const diff = Math.floor((Date.now() - updated.getTime()) / 60000) // minutes
      return diff === 0 ? 'just now' : `${diff} ${diff === 1 ? 'minute' : 'minutes'} ago`
    }
    if (!lastSaved) return 'never'
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 60000)
    return diff === 0 ? 'just now' : `${diff} ${diff === 1 ? 'minute' : 'minutes'} ago`
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Toolbar - Klaviyo Style */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link href="/marketing/templates" className="text-gray-500 hover:text-gray-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            {template.channel === 'email' ? (
              <Mail className="h-4 w-4 text-gray-400" />
            ) : (
              <MessageSquare className="h-4 w-4 text-gray-400" />
            )}
            <span className="font-medium text-gray-900">{name}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              template.channel === 'email'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-purple-50 text-purple-700'
            }`}>
              {template.channel === 'email' ? 'Email' : 'SMS'}
            </span>
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
        </div>
        
        <div className="flex items-center gap-4">
          {template.channel === 'email' && editorType === 'dragdrop' && (
            <>
              {template.channel === 'email' && editorType === 'dragdrop' && emailBuilderRef.current && (
                <>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (emailBuilderRef.current) {
                          emailBuilderRef.current.undo()
                        }
                      }}
                      disabled={emailBuilderRef.current ? !emailBuilderRef.current.canUndo : true}
                      className="h-7 w-7 p-0"
                      title="Undo"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (emailBuilderRef.current) {
                          emailBuilderRef.current.redo()
                        }
                      }}
                      disabled={emailBuilderRef.current ? !emailBuilderRef.current.canRedo : true}
                      className="h-7 w-7 p-0"
                      title="Redo"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="h-6 w-px bg-gray-300" />
                </>
              )}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className="h-7 px-3"
                >
                  <Monitor className="h-3 w-3" />
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className="h-7 px-3"
                >
                  <Smartphone className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved || template.updatedAt ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Last saved: {getTimeSinceSave()}</span>
              </>
            ) : null}
          </div>
          
          <div className="flex items-center gap-2">
            {template.channel === 'email' && (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  handlePreview()
                  setShowPreview(true)
                }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview & test
                </Button>
              </>
            )}
            {template.status === 'draft' && (
              <Button size="sm" onClick={handlePublish} disabled={loading || saving}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Publish
              </Button>
            )}
            <Link href="/marketing/templates">
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Template Details */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-sm text-gray-900">Template Details</h2>
          </div>
          
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-medium text-gray-700">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Appointment Reminder"
                className="h-9 text-sm"
              />
            </div>

            {template.channel === 'email' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs font-medium text-gray-700">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject line"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preheader" className="text-xs font-medium text-gray-700">Preheader</Label>
                  <Input
                    id="preheader"
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Preview text (optional)"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editorType" className="text-xs font-medium text-gray-700">Editor Type</Label>
                  <Select value={editorType} onValueChange={(v: any) => setEditorType(v)}>
                    <SelectTrigger id="editorType" className="h-9 text-sm">
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

            {/* Template Metadata */}
            <div className="pt-4 border-t border-gray-200 space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Channel:</span>
                <span className="text-gray-900 uppercase">{template.channel}</span>
              </div>
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="text-gray-900 capitalize">{template.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated:</span>
                <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
              </div>
              {template.lastPublishedAt && (
                <div className="flex justify-between">
                  <span>Published:</span>
                  <span>{new Date(template.lastPublishedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={loading}
                className="w-full text-xs"
              >
                <Copy className="h-3 w-3 mr-2" />
                Duplicate
              </Button>
              {template.status !== 'archived' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={loading}
                  className="w-full text-xs"
                >
                  <Archive className="h-3 w-3 mr-2" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {template.channel === 'email' && editorType === 'dragdrop' ? (
            <EmailBuilder
              ref={emailBuilderRef}
              initialDoc={(template.bodyJson as any) || { rows: [], globalStyles: {} }}
              brandProfile={brandProfile}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
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
                  setLastSaved(new Date())
                  router.refresh()
                } catch (err: any) {
                  setError(err.message || 'Failed to save template')
                } finally {
                  setSaving(false)
                }
              }}
              onPreview={() => setShowPreview(true)}
              saving={saving}
            />
          ) : template.channel === 'email' && editorType === 'html' ? (
            <div className="flex-1 flex flex-col p-6 bg-white">
              <div className="mb-4">
                <Label htmlFor="bodyHtml" className="text-sm font-medium text-gray-700">Email Body (HTML) *</Label>
                  <p className="text-xs text-gray-500 mt-1">
                  Use HTML markup. Variables: {'{{'}patient.firstName{'}}'}, {'{{'}appointment.date{'}}'}, etc.
                </p>
              </div>
              <Textarea
                id="bodyHtml"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="Enter HTML content. Use {{variable}} syntax for personalization."
                className="flex-1 font-mono text-sm min-h-[400px]"
              />
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditorType('dragdrop')}>
                  Switch to Drag & Drop Builder
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>
          ) : (
            /* SMS Template Editor */
            <div className="flex-1 flex flex-col p-6 bg-white">
              <div className="mb-4">
                <Label htmlFor="bodyText" className="text-sm font-medium text-gray-700">Message Text *</Label>
                <p className="text-xs text-gray-500 mt-1">
                  SMS is text-only. Keep messages short and use {'{{'}variable{'}}'} placeholders.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  GSM-7: 160 chars per segment. Unicode (emojis/non-Latin): 70 chars per segment.
                </p>
              </div>
              <Textarea
                id="bodyText"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Enter SMS message. Use {{variable}} syntax for personalization."
                className="flex-1 font-mono text-sm min-h-[400px] mb-4"
              />
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + '{{patient.firstName}}')}
                  className="text-xs"
                >
                  Insert: patient.firstName
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + '{{appointment.date}}')}
                  className="text-xs"
                >
                  Insert: appointment.date
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + '{{practice.name}}')}
                  className="text-xs"
                >
                  Insert: practice.name
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + '{{practice.phone}}')}
                  className="text-xs"
                >
                  Insert: practice.phone
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + '{{links.confirm}}')}
                  className="text-xs"
                >
                  Insert: links.confirm
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBodyText(bodyText + ' Reply STOP to opt out.')}
                  className="text-xs"
                >
                  Insert: opt-out text
                </Button>
              </div>
              
              {smsStats && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                  <div className="flex justify-between mb-1">
                    <span>Characters:</span>
                    <span className="font-medium">{smsStats.characterCount}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Segments:</span>
                    <span className="font-medium">{smsStats.segments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Encoding:</span>
                    <span className="font-medium">{smsStats.encoding}</span>
                  </div>
                  {smsStats.segments > 1 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-yellow-700">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      This message will be sent as {smsStats.segments} segment(s), which may increase cost.
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowTest(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Test Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test</DialogTitle>
          </DialogHeader>
          <TestSendForm templateId={template.id} channel={template.channel} />
        </DialogContent>
      </Dialog>
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
