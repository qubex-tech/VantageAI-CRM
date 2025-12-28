'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export default function NewAppointmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('New appointment page error:', error)
  }, [error])

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900">Error Loading Appointment Form</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            An error occurred while loading the appointment scheduling form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error.message}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={reset}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
            >
              Try again
            </Button>
            <Button
              onClick={() => router.push('/patients')}
              variant="outline"
              className="flex-1"
            >
              Back to Patients
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

