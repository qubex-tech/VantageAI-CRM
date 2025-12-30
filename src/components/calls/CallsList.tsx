'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'

interface RetellCallListItem {
  call_id: string
  call_type: 'phone_call' | 'web_call'
  agent_id: string
  call_status: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
}

interface CallsListProps {
  initialCalls: RetellCallListItem[]
  error?: string | null
}

export function CallsList({ initialCalls, error: initialError }: CallsListProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [calls, setCalls] = useState(initialCalls)
  const [error, setError] = useState<string | null>(initialError || null)

  // Refresh function
  const refreshCalls = async (processCalls: boolean = false) => {
    setIsRefreshing(true)
    setError(null)
    
    try {
      // Fetch directly via API for immediate update
      // Add ?process=true to trigger patient extraction
      const url = processCalls ? '/api/calls?limit=50&process=true' : '/api/calls?limit=50'
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok && data.calls) {
        setCalls(data.calls)
        // Also refresh the server component data to keep it in sync
        router.refresh()
        
        if (processCalls) {
          console.log('[CallsList] Processed calls for patient extraction')
        }
      } else {
        setError(data.error || 'Failed to refresh calls')
      }
    } catch (err) {
      console.error('Error refreshing calls:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh calls')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Sync initial calls when they change from server
  useEffect(() => {
    setCalls(initialCalls)
    setError(initialError || null)
  }, [initialCalls, initialError])

  // Auto-refresh when page becomes visible or window regains focus (user switches back to the tab)
  // Also process calls on initial load and when tab becomes visible to extract patient data
  useEffect(() => {
    let mounted = true
    
    // Process calls on initial mount to extract patient data
    refreshCalls(true)
    
    const handleVisibilityChange = () => {
      if (mounted && document.visibilityState === 'visible') {
        refreshCalls(true) // Process calls when tab becomes visible
      }
    }

    const handleFocus = () => {
      if (mounted) {
        refreshCalls(true) // Process calls when window gains focus
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only set up listeners once on mount

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ended':
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'in-progress':
      case 'ongoing':
        return 'bg-blue-100 text-blue-700'
      case 'registered':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div>
      {/* Header with refresh button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Calls</h1>
          <p className="text-sm text-gray-500">
            Voice agent calls from RetellAI
          </p>
        </div>
        <Button
          onClick={() => refreshCalls(true)}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-500 mt-2">
              {error.includes('not configured') && 'Please configure your RetellAI integration in Settings.'}
            </p>
          </CardContent>
        </Card>
      ) : calls.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No calls found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <Link key={call.call_id} href={`/calls/${call.call_id}`}>
              <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-gray-900">
                      Call {call.call_id.slice(0, 8)}...
                    </CardTitle>
                    <span className={`inline-block text-xs px-2 py-1 rounded-md font-medium ${getStatusColor(call.call_status)}`}>
                      {call.call_status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {call.start_timestamp && (
                        <span>
                          {format(new Date(call.start_timestamp), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {call.duration_ms && (
                        <span>• {formatDuration(call.duration_ms)}</span>
                      )}
                      <span className="capitalize">• {call.call_type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
