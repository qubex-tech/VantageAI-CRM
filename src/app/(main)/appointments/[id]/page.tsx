import { redirect, notFound } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import Link from 'next/link'
import { getCalClient } from '@/lib/cal'
import { syncBookingToPatient } from '@/lib/sync-booking-to-patient'

export const dynamic = 'force-dynamic'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Check if this is a Cal.com booking (ID starts with "cal-")
  const isCalBooking = id.startsWith('cal-')
  let appointment: any = null
  let calBooking: any = null

  if (isCalBooking) {
    // Extract the booking UID from the ID (format: "cal-{uid}" or "cal-{id}")
    const bookingIdentifier = id.replace('cal-', '')
    
    try {
      // Fetch the booking from Cal.com API
      const calClient = await getCalClient(user.practiceId)
      // Try to find by UID first, then by ID if UID doesn't work
      let bookingsResponse = await calClient.getBookings({
        bookingUid: bookingIdentifier,
        take: 1,
      })
      
      // If not found by UID, try by numeric ID
      if (!bookingsResponse.data || bookingsResponse.data.length === 0) {
        const numericId = parseInt(bookingIdentifier, 10)
        if (!isNaN(numericId)) {
          // Get all bookings and filter by ID (since there's no direct ID filter)
          bookingsResponse = await calClient.getBookings({
            take: 100,
          })
          if (bookingsResponse.data) {
            calBooking = bookingsResponse.data.find((b: any) => b.id === numericId || b.uid === bookingIdentifier)
          }
        }
      } else {
        calBooking = bookingsResponse.data[0]
      }
      
      if (!calBooking) {
        notFound()
      }
      
      // Sync booking to patient record (find or create, merge info, add timeline)
      try {
        await syncBookingToPatient(user.practiceId, calBooking, user.id)
      } catch (error) {
        // Log error but don't fail the page load
        console.error(`Error syncing booking ${calBooking.uid || calBooking.id} to patient:`, error)
      }
    } catch (error) {
      console.error('Error fetching Cal.com booking:', error)
      notFound()
    }
  } else {
    // Fetch local appointment from database
    appointment = await prisma.appointment.findFirst({
      where: {
        id,
        practiceId: user.practiceId,
      },
      include: {
        patient: true,
      },
    })

    if (!appointment) {
      notFound()
    }
  }

  // For Cal.com bookings, get the patient (should already exist after sync)
  if (calBooking) {
    const attendeeEmail = calBooking.attendees?.[0]?.email
    const attendeePhone = calBooking.attendees?.[0]?.phoneNumber?.replace(/\D/g, '')
    const attendeeName = calBooking.attendees?.[0]?.name
    
    // Try to find patient by email first
    if (attendeeEmail) {
      const patient = await prisma.patient.findFirst({
        where: {
          practiceId: user.practiceId,
          email: attendeeEmail,
          deletedAt: null,
        },
      })
      
      if (patient) {
        calBooking.patient = patient
      }
    }
    
    // If not found by email, try by phone
    if (!calBooking.patient && attendeePhone) {
      const patient = await prisma.patient.findFirst({
        where: {
          practiceId: user.practiceId,
          phone: attendeePhone,
          deletedAt: null,
        },
      })
      
      if (patient) {
        calBooking.patient = patient
      }
    }
    
    // If still not found, try by name
    if (!calBooking.patient && attendeeName) {
      const patient = await prisma.patient.findFirst({
        where: {
          practiceId: user.practiceId,
          name: {
            contains: attendeeName,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      })
      
      if (patient) {
        calBooking.patient = patient
      }
    }
  }

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <Link href="/appointments" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
          ← Back to Appointments
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {appointment ? 'Appointment Details' : 'Booking Details'}
        </h1>
        <p className="text-sm text-gray-500">
          {appointment ? `Appointment ID: ${appointment.id.slice(0, 8)}...` : `Booking ID: ${calBooking?.uid || calBooking?.id}`}
        </p>
      </div>

      {appointment ? (
        // Display local appointment details
        <div className="space-y-4">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Patient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-sm text-gray-900 mt-1">{appointment.patient.name}</p>
              </div>
              {appointment.patient.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900 mt-1">{appointment.patient.phone}</p>
                </div>
              )}
              {appointment.patient.email && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-sm text-gray-900 mt-1">{appointment.patient.email}</p>
                </div>
              )}
              {appointment.patient.id && (
                <div>
                  <Link 
                    href={`/patients/${appointment.patient.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View Patient Profile →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Appointment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Visit Type</p>
                <p className="text-sm text-gray-900 mt-1">{appointment.visitType}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Date & Time</p>
                <p className="text-sm text-gray-900 mt-1">
                  {format(appointment.startTime, 'MMMM d, yyyy h:mm a')} - {format(appointment.endTime, 'h:mm a')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Timezone</p>
                <p className="text-sm text-gray-900 mt-1">{appointment.timezone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium mt-1">
                  {appointment.status}
                </span>
              </div>
              {appointment.reason && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Reason</p>
                  <p className="text-sm text-gray-900 mt-1">{appointment.reason}</p>
                </div>
              )}
              {appointment.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : calBooking ? (
        // Display Cal.com booking details with all available information
        <div className="space-y-4">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Attendee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calBooking.attendees && calBooking.attendees.length > 0 ? (
                calBooking.attendees.map((attendee: any, index: number) => (
                  <div key={index} className={index > 0 ? 'pt-3 border-t border-gray-200' : ''}>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p className="text-sm text-gray-900 mt-1">{attendee.name || 'N/A'}</p>
                    </div>
                    {attendee.email && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Email</p>
                        <p className="text-sm text-gray-900 mt-1">{attendee.email}</p>
                      </div>
                    )}
                    {attendee.phoneNumber && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Phone</p>
                        <p className="text-sm text-gray-900 mt-1">{attendee.phoneNumber}</p>
                      </div>
                    )}
                    {attendee.timeZone && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Timezone</p>
                        <p className="text-sm text-gray-900 mt-1">{attendee.timeZone}</p>
                      </div>
                    )}
                    {attendee.language && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Language</p>
                        <p className="text-sm text-gray-900 mt-1">{attendee.language}</p>
                      </div>
                    )}
                    {attendee.absent !== undefined && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Absent</p>
                        <p className="text-sm text-gray-900 mt-1">{attendee.absent ? 'Yes' : 'No'}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No attendee information available</p>
              )}
              {calBooking.patient?.id && (
                <div className="pt-3 border-t border-gray-200">
                  <Link 
                    href={`/patients/${calBooking.patient.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View Patient Profile →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {calBooking.hosts && calBooking.hosts.length > 0 && (
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Host Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {calBooking.hosts.map((host: any, index: number) => (
                  <div key={index} className={index > 0 ? 'pt-3 border-t border-gray-200' : ''}>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Name</p>
                      <p className="text-sm text-gray-900 mt-1">{host.name || 'N/A'}</p>
                    </div>
                    {host.email && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Email</p>
                        <p className="text-sm text-gray-900 mt-1">{host.email}</p>
                      </div>
                    )}
                    {host.username && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Username</p>
                        <p className="text-sm text-gray-900 mt-1">{host.username}</p>
                      </div>
                    )}
                    {host.timeZone && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500">Timezone</p>
                        <p className="text-sm text-gray-900 mt-1">{host.timeZone}</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Title</p>
                <p className="text-sm text-gray-900 mt-1">{calBooking.title || 'N/A'}</p>
              </div>
              {calBooking.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Description</p>
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{calBooking.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Date & Time</p>
                <p className="text-sm text-gray-900 mt-1">
                  {format(new Date(calBooking.start), 'MMMM d, yyyy h:mm a')} - {format(new Date(calBooking.end), 'h:mm a')}
                </p>
              </div>
              {calBooking.duration && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.duration} minutes</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className="inline-block text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium mt-1">
                  {calBooking.status || 'N/A'}
                </span>
              </div>
              {calBooking.location && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {calBooking.location.startsWith('http') ? (
                      <a href={calBooking.location} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        {calBooking.location}
                      </a>
                    ) : (
                      calBooking.location
                    )}
                  </p>
                </div>
              )}
              {calBooking.eventType && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Type</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.eventType.slug || calBooking.eventTypeId || 'N/A'}</p>
                </div>
              )}
              {calBooking.meetingUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Meeting URL</p>
                  <a 
                    href={calBooking.meetingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline mt-1 block"
                  >
                    {calBooking.meetingUrl}
                  </a>
                </div>
              )}
              {calBooking.cancellationReason && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Cancellation Reason</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.cancellationReason}</p>
                </div>
              )}
              {calBooking.cancelledByEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Cancelled By</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.cancelledByEmail}</p>
                </div>
              )}
              {calBooking.reschedulingReason && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Rescheduling Reason</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.reschedulingReason}</p>
                </div>
              )}
              {calBooking.rescheduledByEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Rescheduled By</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.rescheduledByEmail}</p>
                </div>
              )}
              {calBooking.rating !== undefined && calBooking.rating !== null && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Rating</p>
                  <p className="text-sm text-gray-900 mt-1">{calBooking.rating} / 5</p>
                </div>
              )}
              {calBooking.guests && calBooking.guests.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Guests</p>
                  <div className="mt-1 space-y-1">
                    {calBooking.guests.map((guest: string, index: number) => (
                      <p key={index} className="text-sm text-gray-900">{guest}</p>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Created At</p>
                <p className="text-sm text-gray-900 mt-1">
                  {calBooking.createdAt ? format(new Date(calBooking.createdAt), 'MMMM d, yyyy h:mm a') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Updated At</p>
                <p className="text-sm text-gray-900 mt-1">
                  {calBooking.updatedAt ? format(new Date(calBooking.updatedAt), 'MMMM d, yyyy h:mm a') : 'N/A'}
                </p>
              </div>
              {calBooking.bookingFieldsResponses && Object.keys(calBooking.bookingFieldsResponses).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Custom Fields</p>
                  <div className="mt-1 space-y-2">
                    {Object.entries(calBooking.bookingFieldsResponses).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs font-medium text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-sm text-gray-900 mt-0.5">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {calBooking.metadata && Object.keys(calBooking.metadata).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Metadata</p>
                  <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(calBooking.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        notFound()
      )}
    </div>
  )
}

