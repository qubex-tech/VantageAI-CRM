import { getCalClient, type CalBooking } from '@/lib/cal'
import { calBookingIdAliases } from '@/lib/cal-booking-id'

export type CalAppointmentWritebackResult = {
  status: 'skipped' | 'success' | 'error'
  reason?: string
}

export type CancelSupersededCalBookingsResult = {
  cancelledBookingIds: string[]
  skippedBookingIds: string[]
}

export function calBookingMatchesStoredId(
  booking: Pick<CalBooking, 'id' | 'uid'>,
  storedCalBookingId: string | null | undefined
): boolean {
  if (!storedCalBookingId) return false
  const aliases = calBookingIdAliases(booking.uid, booking.id)
  return aliases.includes(storedCalBookingId)
}

export function calBookingMatchesTimeWindow(
  booking: Pick<CalBooking, 'start'>,
  originalStart: Date,
  toleranceMs = 60_000
): boolean {
  const startMs = new Date(booking.start).getTime()
  return Math.abs(startMs - originalStart.getTime()) <= toleranceMs
}

function storedCalBookingAliases(calBookingId: string): string[] {
  if (/[a-zA-Z]/.test(calBookingId)) {
    return calBookingIdAliases(calBookingId, null)
  }
  return calBookingIdAliases(null, calBookingId)
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

/**
 * After moving a CRM appointment into an earlier slot, cancel the patient's
 * original Cal.com booking (by stored id and/or attendee email + start time).
 */
export async function cancelSupersededCalBookings(params: {
  practiceId: string
  originalCalBookingId: string | null | undefined
  originalStartTime: Date
  patientEmail?: string | null
  /** Never cancel the newly created booking when Cal rebook succeeded. */
  preserveCalBookingId?: string | null
}): Promise<CancelSupersededCalBookingsResult> {
  const cancelledBookingIds: string[] = []
  const skippedBookingIds: string[] = []
  const preserveAliases = params.preserveCalBookingId
    ? storedCalBookingAliases(params.preserveCalBookingId)
    : []

  const queueCancel = async (bookingId: string) => {
    if (preserveAliases.includes(bookingId)) {
      skippedBookingIds.push(bookingId)
      return
    }
    if (cancelledBookingIds.includes(bookingId) || skippedBookingIds.includes(bookingId)) {
      return
    }
    const result = await cancelAppointmentInCal({
      practiceId: params.practiceId,
      calBookingId: bookingId,
    })
    if (result.status === 'success') {
      cancelledBookingIds.push(bookingId)
    } else {
      skippedBookingIds.push(bookingId)
    }
  }

  if (isCalLinkedBooking(params.originalCalBookingId)) {
    await queueCancel(params.originalCalBookingId!)
  }

  const email = params.patientEmail?.trim()
  if (!email) {
    return { cancelledBookingIds, skippedBookingIds }
  }

  try {
    const calClient = await getCalClient(params.practiceId)
    const windowStart = new Date(params.originalStartTime.getTime() - 2 * 60 * 60 * 1000)
    const windowEnd = new Date(params.originalStartTime.getTime() + 2 * 60 * 60 * 1000)
    const response = await calClient.getBookings({
      attendeeEmail: email,
      afterStart: windowStart.toISOString(),
      beforeEnd: windowEnd.toISOString(),
      status: ['upcoming', 'unconfirmed'],
      take: 50,
    })

      for (const booking of response.data || []) {
      if (!calBookingMatchesTimeWindow(booking, params.originalStartTime)) continue
      const aliases = calBookingIdAliases(booking.uid, booking.id)
      if (aliases.some((id) => preserveAliases.includes(id))) continue
      const bookingUid = booking.uid || aliases.find((id) => /[a-zA-Z]/.test(id))
      if (bookingUid) {
        await queueCancel(bookingUid)
      }
    }
  } catch (error) {
    console.warn('[Cal writeback] Failed to search Cal.com for superseded bookings', {
      practiceId: params.practiceId,
      email,
      error: error instanceof Error ? error.message : error,
    })
  }

  return { cancelledBookingIds, skippedBookingIds }
}
