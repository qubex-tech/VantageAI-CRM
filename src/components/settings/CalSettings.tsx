'use client'

import { useState, useEffect } from 'react'
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

interface CalSettingsProps {
  initialIntegration: any
  initialMappings?: any[]
}

interface CalEventType {
  id: string | number
  title: string
  slug: string
  length: number
  description?: string
}

export function CalSettings({ initialIntegration, initialMappings = [] }: CalSettingsProps) {
  const [apiKey, setApiKey] = useState(initialIntegration?.apiKey || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Event type mapping state
  const [eventTypes, setEventTypes] = useState<CalEventType[]>([])
  const [loadingEventTypes, setLoadingEventTypes] = useState(false)
  const [mappings, setMappings] = useState(initialMappings)
  const [newMapping, setNewMapping] = useState({
    calEventTypeId: '',
    visitTypeName: '',
  })
  const [loadingMapping, setLoadingMapping] = useState(false)

  useEffect(() => {
    setMappings(initialMappings)
  }, [initialMappings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/settings/cal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          calOrganizationId: initialIntegration?.calOrganizationId,
          calTeamId: initialIntegration?.calTeamId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('Cal.com integration saved successfully')
      // Clear event types so they need to be fetched again with new API key
      setEventTypes([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/settings/cal/test')
      const data = await response.json()

      if (data.success) {
        setSuccess('Connection test successful!')
      } else {
        setError(data.message || 'Connection test failed')
      }
    } catch (err) {
      setError('Connection test failed')
    } finally {
      setLoading(false)
    }
  }

  const fetchEventTypes = async () => {
    setLoadingEventTypes(true)
    setError('')
    
    try {
      const response = await fetch('/api/settings/cal/event-types?fetch=true')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch event types')
      }
      
      setEventTypes(data.eventTypes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event types')
    } finally {
      setLoadingEventTypes(false)
    }
  }

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoadingMapping(true)

    try {
      const response = await fetch('/api/settings/cal/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMapping),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create mapping')
      }

      const { mapping } = await response.json()
      setMappings([...mappings, mapping])
      setNewMapping({ calEventTypeId: '', visitTypeName: '' })
      setSuccess('Event type mapping created successfully')
      
      // Refresh the page to update the list
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mapping')
    } finally {
      setLoadingMapping(false)
    }
  }

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) {
      return
    }

    try {
      const response = await fetch(`/api/settings/cal/event-types/${mappingId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete mapping')
      }

      setMappings(mappings.filter(m => m.id !== mappingId))
      setSuccess('Mapping deleted successfully')
      
      // Refresh the page to update the list
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mapping')
    }
  }

  // Get available event types (not yet mapped)
  const availableEventTypes = eventTypes.filter(
    et => !mappings.some(m => String(m.calEventTypeId) === String(et.id))
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cal.com Integration</CardTitle>
          <CardDescription>Configure your Cal.com API credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Cal.com API key"
                required
              />
              <p className="text-xs text-muted-foreground">
                You can find your API key in your Cal.com settings
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            {success && (
              <div className="text-sm text-green-600">{success}</div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={loading || !apiKey}
              >
                Test Connection
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {initialIntegration && (
        <Card>
          <CardHeader>
            <CardTitle>Event Type Mappings</CardTitle>
            <CardDescription>
              Map your Cal.com event types to visit types for appointments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Fetch Event Types Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={fetchEventTypes}
                disabled={loadingEventTypes || !apiKey}
              >
                {loadingEventTypes ? 'Loading...' : 'Fetch Cal.com Event Types'}
              </Button>
              {eventTypes.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {eventTypes.length} event types
                </p>
              )}
            </div>

            {/* Create New Mapping Form */}
            {eventTypes.length > 0 && (
              <form onSubmit={handleCreateMapping} className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-sm">Create New Mapping</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calEventTypeId">Cal.com Event Type</Label>
                    <Select
                      value={newMapping.calEventTypeId}
                      onValueChange={(value) => setNewMapping({ ...newMapping, calEventTypeId: value })}
                    >
                      <SelectTrigger id="calEventTypeId">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEventTypes.map((et) => (
                          <SelectItem key={et.id} value={String(et.id)}>
                            {et.title} ({et.length} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visitTypeName">Visit Type Name</Label>
                    <Input
                      id="visitTypeName"
                      value={newMapping.visitTypeName}
                      onChange={(e) => setNewMapping({ ...newMapping, visitTypeName: e.target.value })}
                      placeholder="e.g., Consultation, Follow-up"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loadingMapping || !newMapping.calEventTypeId || !newMapping.visitTypeName}
                >
                  {loadingMapping ? 'Creating...' : 'Create Mapping'}
                </Button>
              </form>
            )}

            {/* Existing Mappings List */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Existing Mappings</h3>
              {mappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mappings yet. Fetch event types and create a mapping to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((mapping) => {
                    const eventType = eventTypes.find(et => String(et.id) === String(mapping.calEventTypeId))
                    return (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{mapping.visitTypeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {eventType ? `${eventType.title} (${eventType.length} min)` : `Event ID: ${mapping.calEventTypeId}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMapping(mapping.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
