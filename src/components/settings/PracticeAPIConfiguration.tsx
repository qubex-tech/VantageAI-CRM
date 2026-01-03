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
import { CalSettingsWithPracticeId } from './CalSettingsWithPracticeId'
import { RetellSettingsWithPracticeId } from './RetellSettingsWithPracticeId'
import { SendgridSettingsWithPracticeId } from './SendgridSettingsWithPracticeId'

interface Practice {
  id: string
  name: string
}

export function PracticeAPIConfiguration() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('')
  const [loadingPractices, setLoadingPractices] = useState(true)

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
          <CalSettingsWithPracticeId practiceId={selectedPracticeId} />
          <RetellSettingsWithPracticeId practiceId={selectedPracticeId} />
          <SendgridSettingsWithPracticeId practiceId={selectedPracticeId} />
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

