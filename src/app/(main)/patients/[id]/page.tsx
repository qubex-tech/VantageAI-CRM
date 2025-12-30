import { redirect } from 'next/navigation'
import { getSupabaseSession } from '@/lib/auth-supabase'
import { syncSupabaseUserToPrisma } from '@/lib/sync-supabase-user'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Phone, Mail, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PatientDetailPage({
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
    redirect('/login?error=Failed to sync user account. Please try again.')
  }
  
  if (!user) {
    redirect('/login?error=User account not found.')
  }

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      practiceId: user.practiceId,
      deletedAt: null,
    },
    include: {
      tags: true,
      insurancePolicies: true,
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 10,
      },
      timelineEntries: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!patient) {
    return (
      <div className="container mx-auto p-4">
        <p>Patient not found</p>
      </div>
    )
  }

  const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()

  return (
    <div className="container mx-auto p-4 space-y-6 pb-20 md:pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{patient.name}</h1>
          <p className="text-gray-500">Age: {age} years</p>
        </div>
        <Link href={`/appointments/new?patientId=${patient.id}`}>
          <Button>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Appointment
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{patient.phone}</span>
            </div>
            {patient.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{patient.email}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span>{patient.address}</span>
              </div>
            )}
            <div className="pt-2">
              <p className="text-sm text-gray-500">
                Preferred: {patient.preferredContactMethod}
              </p>
            </div>
          </CardContent>
        </Card>

        {patient.insurancePolicies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Insurance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.insurancePolicies.map((policy: any) => (
                <div key={policy.id} className="border-b pb-2">
                  <p className="font-medium">{policy.providerName}</p>
                  <p className="text-sm text-gray-500">
                    Member ID: {policy.memberId}
                  </p>
                  <p className="text-xs text-gray-500">
                    Status: {policy.eligibilityStatus}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {patient.appointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Appointments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.appointments.map((apt: any) => (
                <Link
                  key={apt.id}
                  href={`/appointments/${apt.id}`}
                  className="block border-b pb-2 hover:bg-gray-100 p-2 rounded transition-colors"
                >
                  <p className="font-medium">{apt.visitType}</p>
                  <p className="text-sm text-gray-500">
                    {format(apt.startTime, 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500">Status: {apt.status}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {patient.timelineEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No timeline entries</p>
            ) : (
              patient.timelineEntries.map((entry: any) => (
                <div key={entry.id} className="border-b pb-2">
                  <p className="font-medium">{entry.title}</p>
                  {entry.description && (
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {format(entry.createdAt, 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

