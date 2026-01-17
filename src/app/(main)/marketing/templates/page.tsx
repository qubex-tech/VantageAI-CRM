'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { Plus, Mail, MessageSquare, Search, Filter, Copy, Archive } from 'lucide-react'

interface Template {
  id: string
  channel: 'email' | 'sms'
  name: string
  category: string
  status: 'draft' | 'published' | 'archived'
  updatedAt: string
  createdAt: string
  lastPublishedAt: string | null
  createdBy: {
    id: string
    name: string
    email: string
  }
}

function TemplatesList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<'email' | 'sms' | 'all'>(searchParams?.get('channel') as any || 'all')
  const [status, setStatus] = useState<string>(searchParams?.get('status') || 'all')
  const [category, setCategory] = useState<string>(searchParams?.get('category') || 'all')
  const [search, setSearch] = useState<string>(searchParams?.get('q') || '')

  useEffect(() => {
    fetchTemplates()
  }, [channel, status, category, search])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (channel !== 'all') params.set('channel', channel)
      if (status !== 'all') params.set('status', status)
      if (category !== 'all') params.set('category', category)
      if (search) params.set('q', search)

      const response = await fetch(`/api/marketing/templates?${params.toString()}`)
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/marketing/templates/${templateId}/duplicate`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.template) {
        router.push(`/marketing/templates/${data.template.id}`)
      }
    } catch (error) {
      console.error('Error duplicating template:', error)
    }
  }

  const handleArchive = async (templateId: string) => {
    if (!confirm('Are you sure you want to archive this template?')) return
    
    try {
      const response = await fetch(`/api/marketing/templates/${templateId}/archive`, {
        method: 'POST',
      })
      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Error archiving template:', error)
    }
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Templates</h1>
            <p className="text-sm text-gray-500">Create and manage email & SMS templates</p>
          </div>
          <Link href="/marketing/templates/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={channel} onValueChange={(value: any) => setChannel(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
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
        </CardContent>
      </Card>

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-4">No templates found</p>
              <Link href="/marketing/templates/new">
                <Button>Create Your First Template</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {template.channel === 'email' ? (
                        <Mail className="h-5 w-5 text-gray-400" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-gray-400" />
                      )}
                      <Link href={`/marketing/templates/${template.id}`}>
                        <h3 className="font-semibold text-gray-900 hover:underline">
                          {template.name}
                        </h3>
                      </Link>
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
                    <div className="flex items-center gap-4 text-xs text-gray-500 ml-8">
                      <span>{template.category}</span>
                      <span>•</span>
                      <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                      {template.lastPublishedAt && (
                        <>
                          <span>•</span>
                          <span>Published {new Date(template.lastPublishedAt).toLocaleDateString()}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>By {template.createdBy.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template.id)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {template.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(template.id)}
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Link href={`/marketing/templates/${template.id}`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <TemplatesList />
    </Suspense>
  )
}
