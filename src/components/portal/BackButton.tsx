'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const router = useRouter()
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  )
}
