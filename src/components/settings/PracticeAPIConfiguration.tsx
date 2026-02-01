'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { CalSettings } from './CalSettings'
import { RetellSettings } from './RetellSettings'
import { SendgridSettings } from './SendgridSettings'
import { TwilioSettings } from './TwilioSettings'
import { EhrIntegrationsSettings } from './EhrIntegrationsSettings'

interface Practice {
  id: string
  name: string
}

export function PracticeAPIConfiguration() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('')
  const [loadingPractices, setLoadingPractices] = useState(true)
  const [loadingIntegrations, setLoadingIntegrations] = useState(false)
  const [calIntegration, setCalIntegration] = useState<any>(null)
  const [retellIntegration, setRetellIntegration] = useState<any>(null)
  const [sendgridIntegration, setSendgridIntegration] = useState<any>(null)
  const [twilioIntegration, setTwilioIntegration] = useState<any>(null)
  const [eventTypeMappings, setEventTypeMappings] = useState<any[]>([])

  // Fetch all practices
  useEffect(() => {
    const fetchPractices = async () => {
      try {
        const response = await fetch('/api/practices')
        if (!response.ok) {
          throw new Error('Failed to fetch practices')
        }
        const data = await response.json()
        setPractices(data.practices || [])
      } catch (error) {
        console.error('Error fetching practices:', error)
      } finally {
        setLoadingPractices(false)
      }
    }

    fetchPractices()
  }, [])

  // Fetch integrations when practice is selected
  useEffect(() => {
    if (!selectedPracticeId) {
      setCalIntegration(null)
      setRetellIntegration(null)
      setSendgridIntegration(null)
      setTwilioIntegration(null)
      setEventTypeMappings([])
      return
    }

    const fetchIntegrations = async () => {
      setLoadingIntegrations(true)
      try {
        // Fetch Cal.com integration
        const calResponse = await fetch(`/api/settings/cal?practiceId=${selectedPracticeId}`)
        if (calResponse.ok) {
          const calData = await calResponse.json()
          setCalIntegration(calData.integration)
          
          // Fetch event type mappings
          const mappingsResponse = await fetch(`/api/settings/cal/event-types?practiceId=${selectedPracticeId}`)
          if (mappingsResponse.ok) {
            const mappingsData = await mappingsResponse.json()
            setEventTypeMappings(mappingsData.mappings || [])
          }
        }

        // Fetch RetellAI integration
        const retellResponse = await fetch(`/api/settings/retell?practiceId=${selectedPracticeId}`)
        if (retellResponse.ok) {
          const retellData = await retellResponse.json()
          setRetellIntegration(retellData.integration)
        }

        // Fetch SendGrid integration
        const sendgridResponse = await fetch(`/api/settings/sendgrid?practiceId=${selectedPracticeId}`)
        if (sendgridResponse.ok) {
          const sendgridData = await sendgridResponse.json()
          setSendgridIntegration(sendgridData.integration)
        }

        // Fetch Twilio integration
        const twilioResponse = await fetch(`/api/settings/twilio?practiceId=${selectedPracticeId}`)
        if (twilioResponse.ok) {
          const twilioData = await twilioResponse.json()
          setTwilioIntegration(twilioData.integration)
        }
      } catch (error) {
        console.error('Error fetching integrations:', error)
      } finally {
        setLoadingIntegrations(false)
      }
    }

    fetchIntegrations()
  }, [selectedPracticeId])

  const selectedPractice = practices.find(p => p.id === selectedPracticeId)

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Practice API Configuration</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Configure API keys and integrations for each practice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="practice-select" className="text-sm font-medium text-gray-700">
                Select Practice
              </label>
              {loadingPractices ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading practices...
                </div>
              ) : (
                <Select value={selectedPracticeId} onValueChange={setSelectedPracticeId}>
                  <SelectTrigger id="practice-select" className="w-full">
                    <SelectValue placeholder="Select a practice to configure" />
                  </SelectTrigger>
                  <SelectContent>
                    {practices.length === 0 ? (
                      <SelectItem value="" disabled>
                        No practices available
                      </SelectItem>
                    ) : (
                      practices.map((practice) => (
                        <SelectItem key={practice.id} value={practice.id}>
                          {practice.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedPracticeId && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Configuring APIs for: <span className="font-semibold">{selectedPractice?.name}</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPracticeId && (
        <div className="space-y-6">
          {loadingIntegrations ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <CalSettingsWithPracticeId 
                practiceId={selectedPracticeId}
                initialIntegration={calIntegration}
                initialMappings={eventTypeMappings}
              />
              <RetellSettingsWithPracticeId 
                practiceId={selectedPracticeId}
                initialIntegration={retellIntegration}
              />
              <SendgridSettingsWithPracticeId 
                practiceId={selectedPracticeId}
                initialIntegration={sendgridIntegration}
              />
              <TwilioSettingsWithPracticeId
                practiceId={selectedPracticeId}
                initialIntegration={twilioIntegration}
              />
              <EhrIntegrationsSettings practiceId={selectedPracticeId} />
            </>
          )}
        </div>
      )}

      {!selectedPracticeId && (
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">
              Select a practice above to configure its API integrations
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Wrapper components that use the existing settings components but include practiceId in API calls
function CalSettingsWithPracticeId({ 
  practiceId, 
  initialIntegration, 
  initialMappings 
}: { 
  practiceId: string
  initialIntegration: any
  initialMappings?: any[]
}) {
  return <CalSettings initialIntegration={initialIntegration} initialMappings={initialMappings} practiceId={practiceId} />
}

function RetellSettingsWithPracticeId({ 
  practiceId, 
  initialIntegration 
}: { 
  practiceId: string
  initialIntegration: any
}) {
  return <RetellSettings initialIntegration={initialIntegration} practiceId={practiceId} />
}

function SendgridSettingsWithPracticeId({ 
  practiceId, 
  initialIntegration 
}: { 
  practiceId: string
  initialIntegration: any
}) {
  return <SendgridSettings initialIntegration={initialIntegration} practiceId={practiceId} />
}

function TwilioSettingsWithPracticeId({
  practiceId,
  initialIntegration,
}: {
  practiceId: string
  initialIntegration: any
}) {
  return <TwilioSettings initialIntegration={initialIntegration} practiceId={practiceId} />
}
