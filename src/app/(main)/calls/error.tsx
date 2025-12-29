'use client'

import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CallsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Calls page error:', error)
  }, [error])

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <Card className="border border-red-200 bg-red-50">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-600 mb-6">
            {error.message || 'Failed to load calls'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

