'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConfirmButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const handleConfirm = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/portal/appointments/${appointmentId}/confirm`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to confirm appointment')
      }
      
      // Refresh the page to show updated status
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to confirm appointment')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <button
      onClick={handleConfirm}
      disabled={loading}
      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Confirming...' : 'Confirm Appointment'}
    </button>
  )
}

export function CancelButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`/api/portal/appointments/${appointmentId}/cancel`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel appointment')
      }
      
      // Refresh the page to show updated status
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel appointment')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Cancelling...' : 'Cancel'}
    </button>
  )
}
