'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, MessageSquare, Sparkles, FileText } from 'lucide-react'
import { TEMPLATE_LIBRARY, getTemplatesByChannel } from '@/lib/marketing/template-library'

export default function NewTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'library' | 'blank'>('library')
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | ''>('')
  const [formData, setFormData] = useState({
    channel: '' as 'email' | 'sms' | '',
    name: '',
    category: '' as string,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/marketing/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'draft',
          editorType: formData.channel === 'sms' ? 'plaintext' : 'dragdrop',
          bodyText: formData.channel === 'sms' ? '' : undefined,
          bodyHtml: formData.channel === 'email' ? '' : undefined,
          bodyJson: formData.channel === 'email' ? { rows: [] } : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create template')
      }

      const { template } = await response.json()
      router.push(`/marketing/templates/${template.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create template')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = async (templateId: string) => {
    setLoading(true)
    setError('')
    
    try {
      const template = TEMPLATE_LIBRARY.find((t) => t.id === templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      const response = await fetch('/api/marketing/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: template.channel,
          name: `${template.name} (Copy)`,
          category: template.category,
          status: 'draft',
          editorType: template.channel === 'sms' ? 'plaintext' : 'dragdrop',
          bodyJson: template.channel === 'email' ? template.template : undefined,
          bodyHtml: undefined,
          bodyText: template.channel === 'sms' ? template.bodyText : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create template')
      }

      const { template: newTemplate } = await response.json()
      router.push(`/marketing/templates/${newTemplate.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create template from library')
      setLoading(false)
    }
  }

  const emailTemplates = getTemplatesByChannel('email')
  const smsTemplates = getTemplatesByChannel('sms')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create New Template</h1>
        <p className="text-sm text-gray-500">Start from a template or create from scratch</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'library' | 'blank')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Template Library
          </TabsTrigger>
          <TabsTrigger value="blank" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Start from Scratch
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose a Template</CardTitle>
              <CardDescription>Select a pre-designed template to get started quickly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Channel</Label>
                  <Select
                    value={selectedChannel}
                    onValueChange={(value: 'email' | 'sms') => setSelectedChannel(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel to filter templates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>Email Templates</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>SMS Templates</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {(selectedChannel === 'email' ? emailTemplates : selectedChannel === 'sms' ? smsTemplates : [...emailTemplates, ...smsTemplates]).map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{template.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              template.channel === 'email'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-purple-50 text-purple-700'
                            }`}>
                              {template.channel === 'email' ? 'Email' : 'SMS'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <Button
                            onClick={() => handleUseTemplate(template.id)}
                            disabled={loading}
                            className="w-full"
                            size="sm"
                          >
                            {loading ? 'Creating...' : 'Use Template'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {(!selectedChannel || (selectedChannel === 'email' && emailTemplates.length === 0) || (selectedChannel === 'sms' && smsTemplates.length === 0)) && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No templates available for this channel yet.</p>
                    <p className="text-sm mt-2">Try starting from scratch instead.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blank">
          <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>Basic information for your new template</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-2">
              <Label htmlFor="channel">Channel *</Label>
              <Select
                value={formData.channel}
                onValueChange={(value: 'email' | 'sms') => setFormData({ ...formData, channel: value })}
                required
              >
                <SelectTrigger id="channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>SMS</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {formData.channel === 'sms' && (
                <p className="text-xs text-gray-500">
                  SMS templates are text-only. Keep messages short and use {'{{'}variable{'}}'} placeholders.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appointment Reminder"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="confirmation">Confirmation</SelectItem>
                  <SelectItem value="reactivation">Reactivation</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="reviews">Reviews</SelectItem>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Template'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
