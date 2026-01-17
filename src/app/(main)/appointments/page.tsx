import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'
import { getCalClient } from '@/lib/cal'
import { syncBookingToPatient } from '@/lib/sync-booking-to-patient'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>
}) {
  const params = await searchParams
  const supabaseSession = await getSupabaseSession()
  
  if (!supabaseSession) {
    redirect('/login')
  }

  const supabaseUser = supabaseSession.user
  let user
  try {
    user = await syncSupabaseUserToPrisma(supabaseUser)
  } catch (error) {
    console.error('Error syncing user to Prisma:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    const safeErrorMessage = errorMessage.length > 100 
      ? errorMessage.substring(0, 100) + '...'
      : errorMessage
    redirect(`/login?error=${encodeURIComponent(`Failed to sync user account: ${safeErrorMessage}`)}`)
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  const date = params.date ? new Date(params.date) : null
  const status = params.status

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    // If no practiceId, return empty appointments list
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Appointments</h1>
          <p className="text-sm text-gray-500">
            {date ? format(date, 'MMMM d, yyyy') : 'Upcoming appointments'}
          </p>
        </div>
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No appointments scheduled</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  const practiceId = user.practiceId

  // Fetch local appointments from database
  const where: any = {
    practiceId: practiceId,
  }

  // If a specific date is provided, filter to that day
  // Otherwise, show all upcoming appointments (from today onwards)
  if (date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    where.startTime = {
      gte: startOfDay,
      lte: endOfDay,
    }
  } else {
    // Show all future appointments by default
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    where.startTime = {
      gte: today,
    }
  }

  if (status) {
    where.status = status
  }

  const localAppointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          phone: true,
          primaryPhone: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  // Fetch Cal.com bookings and merge with local appointments
  let calBookings: any[] = []
  try {
    const calClient = await getCalClient(practiceId)
      
      // Build query params for Cal.com API
      const calParams: any = {
        sortStart: 'asc',
        take: 100, // Get up to 100 bookings
      }
      
      // Map status filter if provided
      if (status) {
        const statusMap: Record<string, string[]> = {
          'scheduled': ['upcoming'],
          'confirmed': ['upcoming'],
          'cancelled': ['cancelled'],
          'completed': ['past'],
        }
        if (statusMap[status]) {
          calParams.status = statusMap[status]
        }
      } else {
        // Default to upcoming if no date filter
        if (!date) {
          calParams.status = ['upcoming']
        }
      }
      
      // Add date filters if provided
      if (date) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)
        calParams.afterStart = startOfDay.toISOString()
        calParams.beforeEnd = endOfDay.toISOString()
      } else {
        // Only show upcoming bookings if no date filter
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        calParams.afterStart = today.toISOString()
      }
      
      const bookingsResponse = await calClient.getBookings(calParams)
      calBookings = bookingsResponse.data || []
  } catch (error) {
    // If Cal.com is not configured or fails, just use local appointments
    console.error('Error fetching Cal.com bookings:', error)
  }

  // Combine local appointments and Cal.com bookings
  // Create a map to avoid duplicates (bookings that already exist in local DB)
  const localBookingIds = new Set(localAppointments.map(apt => apt.calBookingId).filter(Boolean))
  
  // Filter out Cal.com bookings that are already in local DB
  const newCalBookings = calBookings.filter(booking => {
    const bookingId = booking.uid || String(booking.id)
    return !localBookingIds.has(bookingId)
  })

  // Transform Cal.com bookings to match appointment structure for display
  // Also sync each booking to patient records
  const transformedCalBookings = await Promise.all(
    newCalBookings.map(async (booking) => {
      // Sync booking to patient record (find or create, merge info, add timeline)
      let syncResult = null
      try {
        console.log(`[AppointmentsPage] Syncing booking ${booking.uid || booking.id} to patient for practice ${practiceId}`)
        syncResult = await syncBookingToPatient(practiceId, booking, user.id)
        console.log(`[AppointmentsPage] Sync result:`, { patientId: syncResult.patientId, isNew: syncResult.isNew })
      } catch (error) {
        // Log error but don't fail the entire page load
        console.error(`[AppointmentsPage] Error syncing booking ${booking.uid || booking.id} to patient:`, error)
        console.error(`[AppointmentsPage] Error details:`, error instanceof Error ? error.stack : error)
      }
      
      // Get patient info (either from sync result or fallback to booking attendee data)
      let patient = null
      if (syncResult?.patientId) {
        patient = await prisma.patient.findUnique({
          where: { id: syncResult.patientId },
          select: {
            id: true,
            name: true,
            phone: true,
          },
        })
      }
      
      // Fallback to attendee data if sync didn't work
      if (!patient) {
        const attendeeEmail = booking.attendees?.[0]?.email
        if (attendeeEmail) {
          patient = await prisma.patient.findFirst({
            where: {
              practiceId: practiceId,
              email: attendeeEmail,
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              phone: true,
            },
          })
        }
      }
      
      return {
        id: `cal-${booking.uid || booking.id}`,
        calBookingId: booking.uid || String(booking.id),
        calBookingUid: booking.uid, // Store UID separately for fetching details
        patient: patient || {
          id: null,
          name: booking.attendees?.[0]?.name || 'Unknown',
          phone: booking.attendees?.[0]?.phoneNumber || null,
        },
        startTime: new Date(booking.start),
        endTime: new Date(booking.end),
        visitType: booking.title || booking.eventType?.slug || 'Appointment',
        status: booking.status === 'accepted' ? 'confirmed' : booking.status === 'cancelled' ? 'cancelled' : 'scheduled',
        reason: booking.description || null,
        isCalBooking: true, // Flag to identify Cal.com bookings
        // Store full booking data for detail page
        rawBookingData: booking,
      }
    })
  )

  // Combine and sort all appointments
  const allAppointments = [...localAppointments, ...transformedCalBookings].sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })
  
  const appointments = allAppointments

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Appointments</h1>
        <p className="text-sm text-gray-500">
          {date ? format(date, 'MMMM d, yyyy') : 'Upcoming appointments'}
        </p>
      </div>

      {appointments.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No appointments scheduled</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <Link key={apt.id} href={`/appointments/${apt.id}`}>
              <Card className="border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-900">{apt.patient.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {format(apt.startTime, 'h:mm a')} • {apt.visitType}
                    </p>
                    {apt.reason && (
                      <p className="text-sm text-gray-700">{apt.reason}</p>
                    )}
                    <span className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                      {apt.status}
                    </span>
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
