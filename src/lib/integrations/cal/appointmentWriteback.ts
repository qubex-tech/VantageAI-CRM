import { getCalClient } from '@/lib/cal'

export type CalAppointmentWritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
}

export function isCalLinkedBooking(calBookingId: string | null | undefined): boolean {
  if (!calBookingId?.trim()) return false
  return !calBookingId.startsWith('opendental:')
}

function isCalBookingAlreadyCancelledError(message: string): boolean {
  return (
    message.includes('404') ||
    /not found/i.test(message) ||
    /already cancelled/i.test(message) ||
    /already canceled/i.test(message)
  )
}

/**
 * Cancel a Cal.com booking linked to a CRM appointment. Best-effort: does not throw.
 */
export async function cancelAppointmentInCal(params: {
  practiceId: string
  calBookingId: string | null | undefined
}): Promise<CalAppointmentWritebackResult> {
  if (!isCalLinkedBooking(params.calBookingId)) {
    return { status: 'skipped', reason: 'not_cal_linked' }
  }

  try {
    const calClient = await getCalClient(params.practiceId)
    await calClient.cancelBooking(params.calBookingId!)
    return { status: 'success' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isCalBookingAlreadyCancelledError(message)) {
      console.warn('[Cal writeback] Booking already cancelled or missing in Cal.com', {
        practiceId: params.practiceId,
        calBookingId: params.calBookingId,
      })
      return { status: 'skipped', reason: 'already_cancelled_in_cal' }
    }

    console.error('[Cal writeback] Failed to cancel Cal.com booking', {
      practiceId: params.practiceId,
      calBookingId: params.calBookingId,
      error: message,
    })
    return { status: 'error', reason: message }
  }
}
