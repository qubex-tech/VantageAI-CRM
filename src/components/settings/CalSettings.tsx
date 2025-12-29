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

interface AvailabilitySlot {
  time: string
  attendeeCount: number
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
  
  // Availability preview state
  const [availabilityDate, setAvailabilityDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1) // Default to tomorrow
    return date.toISOString().split('T')[0]
  })
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([])
  const [selectedEventTypeForAvailability, setSelectedEventTypeForAvailability] = useState<string | null>(null)

  // State for expanded mappings (which mapping's availability is currently shown)
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null)
  const [mappingAvailability, setMappingAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [loadingMappingAvailability, setLoadingMappingAvailability] = useState<Record<string, boolean>>({})
  const [mappingAvailabilityDates, setMappingAvailabilityDates] = useState<Record<string, string>>({})

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
          calOrganizationId: initialIntegration?.calOrganizationId || undefined,
          calTeamId: initialIntegration?.calTeamId || undefined,
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

  const fetchAvailability = async (eventTypeId: string, date?: string) => {
    setLoadingAvailability(true)
    setAvailableSlots([])
    
    try {
      const dateToCheck = date || availabilityDate
      const dateObj = new Date(dateToCheck)
      const dateFrom = new Date(dateObj)
      dateFrom.setHours(0, 0, 0, 0)
      const dateTo = new Date(dateObj)
      dateTo.setHours(23, 59, 59, 59)
      dateTo.setDate(dateTo.getDate() + 1) // Include next day for timezone handling

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      const params = new URLSearchParams({
        eventTypeId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        timezone,
      })

      const response = await fetch(`/api/appointments/slots?${params.toString()}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch availability')
      }
      
      setAvailableSlots(data.slots || [])
    } catch (err) {
      console.error('Error fetching availability:', err)
      setAvailableSlots([])
    } finally {
      setLoadingAvailability(false)
    }
  }

  const fetchMappingAvailability = async (mappingId: string, eventTypeId: string, date?: string) => {
    setLoadingMappingAvailability(prev => ({ ...prev, [mappingId]: true }))
    setMappingAvailability(prev => ({ ...prev, [mappingId]: [] }))
    
    try {
      const dateToCheck = date || mappingAvailabilityDates[mappingId] || (() => {
        const date = new Date()
        date.setDate(date.getDate() + 1)
        return date.toISOString().split('T')[0]
      })()
      
      const dateObj = new Date(dateToCheck)
      const dateFrom = new Date(dateObj)
      dateFrom.setHours(0, 0, 0, 0)
      const dateTo = new Date(dateObj)
      dateTo.setHours(23, 59, 59, 59)
      dateTo.setDate(dateTo.getDate() + 1)

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      const params = new URLSearchParams({
        eventTypeId,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        timezone,
      })

      const response = await fetch(`/api/appointments/slots?${params.toString()}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch availability')
      }
      
      setMappingAvailability(prev => ({ ...prev, [mappingId]: data.slots || [] }))
    } catch (err) {
      console.error('Error fetching mapping availability:', err)
      setMappingAvailability(prev => ({ ...prev, [mappingId]: [] }))
    } finally {
      setLoadingMappingAvailability(prev => ({ ...prev, [mappingId]: false }))
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
      setSelectedEventTypeForAvailability(null)
      setAvailableSlots([])
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
      
      // Clean up state
      if (expandedMapping === mappingId) {
        setExpandedMapping(null)
      }
      const newMappingAvailability = { ...mappingAvailability }
      delete newMappingAvailability[mappingId]
      setMappingAvailability(newMappingAvailability)
      
      // Refresh the page to update the list
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mapping')
    }
  }

  const handleEventTypeSelect = (eventTypeId: string) => {
    setNewMapping({ ...newMapping, calEventTypeId: eventTypeId })
    setSelectedEventTypeForAvailability(eventTypeId)
    // Automatically fetch availability for the selected event type
    if (eventTypeId) {
      fetchAvailability(eventTypeId)
    }
  }

  const handleToggleMappingAvailability = (mappingId: string, eventTypeId: string) => {
    if (expandedMapping === mappingId) {
      setExpandedMapping(null)
    } else {
      setExpandedMapping(mappingId)
      // Initialize date for this mapping if not set
      if (!mappingAvailabilityDates[mappingId]) {
        const date = new Date()
        date.setDate(date.getDate() + 1)
        setMappingAvailabilityDates(prev => ({ ...prev, [mappingId]: date.toISOString().split('T')[0] }))
      }
      fetchMappingAvailability(mappingId, eventTypeId)
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
              <p className="text-xs text-gray-500">
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
                <p className="text-sm text-gray-500 mt-2">
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
                      onValueChange={handleEventTypeSelect}
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

                {/* Availability Preview */}
                {selectedEventTypeForAvailability && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="availabilityDate" className="text-sm font-medium">
                          View Availability For:
                        </Label>
                        <Input
                          id="availabilityDate"
                          type="date"
                          value={availabilityDate}
                          onChange={(e) => {
                            const newDate = e.target.value
                            setAvailabilityDate(newDate)
                            fetchAvailability(selectedEventTypeForAvailability, newDate)
                          }}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAvailability(selectedEventTypeForAvailability)}
                        disabled={loadingAvailability}
                      >
                        {loadingAvailability ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>

                    {loadingAvailability ? (
                      <p className="text-sm text-gray-500">Loading availability...</p>
                    ) : availableSlots.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Available slots ({availableSlots.length}):
                        </p>
                        <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                          {availableSlots.map((slot, index) => {
                            const slotDate = new Date(slot.time)
                            return (
                              <div
                                key={index}
                                className="px-2 py-1 text-xs bg-white border border-gray-200 rounded text-center"
                              >
                                {slotDate.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No available slots found for this date. Try selecting a different date.
                      </p>
                    )}
                  </div>
                )}

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
                <p className="text-sm text-gray-500">
                  No mappings yet. Fetch event types and create a mapping to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {mappings.map((mapping) => {
                    const eventType = eventTypes.find(et => String(et.id) === String(mapping.calEventTypeId))
                    const isExpanded = expandedMapping === mapping.id
                    const mappingSlots = mappingAvailability[mapping.id] || []
                    const isLoading = loadingMappingAvailability[mapping.id] || false
                    const mappingDate = mappingAvailabilityDates[mapping.id] || (() => {
                      const date = new Date()
                      date.setDate(date.getDate() + 1)
                      return date.toISOString().split('T')[0]
                    })()

                    return (
                      <div key={mapping.id} className="border rounded-lg">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex-1">
                            <p className="font-medium">{mapping.visitTypeName}</p>
                            <p className="text-sm text-gray-500">
                              {eventType ? `${eventType.title} (${eventType.length} min)` : `Event ID: ${mapping.calEventTypeId}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleMappingAvailability(mapping.id, mapping.calEventTypeId)}
                            >
                              {isExpanded ? 'Hide Availability' : 'View Availability'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMapping(mapping.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-gray-50 border-t">
                            <div className="flex items-center gap-4 mb-3">
                              <div className="space-y-1 flex-1">
                                <Label htmlFor={`mapping-availability-date-${mapping.id}`} className="text-sm font-medium">
                                  View Availability For:
                                </Label>
                                <Input
                                  id={`mapping-availability-date-${mapping.id}`}
                                  type="date"
                                  value={mappingDate}
                                  onChange={(e) => {
                                    const newDate = e.target.value
                                    setMappingAvailabilityDates(prev => ({ ...prev, [mapping.id]: newDate }))
                                    fetchMappingAvailability(mapping.id, mapping.calEventTypeId, newDate)
                                  }}
                                  min={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fetchMappingAvailability(mapping.id, mapping.calEventTypeId)}
                                disabled={isLoading}
                              >
                                {isLoading ? 'Loading...' : 'Refresh'}
                              </Button>
                            </div>

                            {isLoading ? (
                              <p className="text-sm text-gray-500">Loading availability...</p>
                            ) : mappingSlots.length > 0 ? (
                              <div>
                                <p className="text-sm font-medium mb-2">
                                  Available slots ({mappingSlots.length}):
                                </p>
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                  {mappingSlots.map((slot, index) => {
                                    const slotDate = new Date(slot.time)
                                    return (
                                      <div
                                        key={index}
                                        className="px-2 py-1 text-xs bg-white border border-gray-200 rounded text-center"
                                      >
                                        {slotDate.toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No available slots found for this date. Try selecting a different date.
                              </p>
                            )}
                          </div>
                        )}
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
