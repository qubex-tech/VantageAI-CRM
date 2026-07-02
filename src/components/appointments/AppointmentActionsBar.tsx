'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AppointmentActionsBarProps {
  appointmentId: string
  status: string
  /** When true, show Pull from Open Dental (practice uses OD scheduling or has OD connection). */
  openDentalActions?: boolean
  isCalBookingOnly?: boolean
  compact?: boolean
  onActionComplete?: () => void
}

export function AppointmentActionsBar({
  appointmentId,
  status,
  openDentalActions = false,
  isCalBookingOnly = false,
  compact = false,
  onActionComplete,
}: AppointmentActionsBarProps) {
  const router = useRouter()
  const [pulling, setPulling] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const isCancelled = status === 'cancelled' || status === 'canceled'
  const canCancel = !isCalBookingOnly && !isCancelled
  const canPull = openDentalActions && !isCalBookingOnly

  const handlePull = async () => {
    setPulling(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/pull`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to pull appointment')

      const outcome = data.result?.outcome
      if (outcome === 'skipped') {
        setMessage(
          data.result?.reason === 'not_linked_to_opendental'
            ? 'This appointment is not linked to Open Dental yet.'
            : 'No updates from Open Dental for this appointment.'
        )
      } else {
        setMessage(
          outcome === 'created'
            ? 'Appointment pulled from Open Dental and linked.'
            : 'Appointment refreshed from Open Dental.'
        )
      }
      router.refresh()
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull appointment')
    } finally {
      setPulling(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel appointment')
      setConfirmCancelOpen(false)
      setMessage('Appointment cancelled.')
      router.refresh()
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel appointment')
    } finally {
      setCancelling(false)
    }
  }

  if (!canPull && !canCancel) return null

  return (
    <>
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-col sm:flex-row gap-3'}>
        {canPull && (
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={handlePull}
            disabled={pulling || cancelling}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${pulling ? 'animate-spin' : ''}`} />
            {pulling ? 'Pulling…' : 'Pull from Open Dental'}
          </Button>
        )}
        {canCancel && (
          <Button
            type="button"
            variant="destructive"
            size={compact ? 'sm' : 'default'}
            onClick={() => setConfirmCancelOpen(true)}
            disabled={pulling || cancelling}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancel appointment
          </Button>
        )}
      </div>

      {(message || error) && (
        <p className={`text-sm mt-2 ${error ? 'text-red-600' : 'text-green-700'}`}>{error || message}</p>
      )}

      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              This marks the appointment as cancelled in the CRM. If it is linked to Open Dental, it will also be
              marked Broken in the practice schedule.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmCancelOpen(false)}>
              Keep appointment
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
