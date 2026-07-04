import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'
import { ScheduleAppointmentForm } from '@/components/appointments/ScheduleAppointmentForm'
import { OpenDentalScheduleForm } from '@/components/appointments/OpenDentalScheduleForm'
import { getSchedulingSettings } from '@/lib/integrations/clinical-system/server'
import {
  canBookAppointments,
  resolveReadSource,
  usesOpenDentalForWrite,
} from '@/lib/integrations/clinical-system/types'
import { getPracticeTimeZone } from '@/lib/practice-timezone'
import { listOpenDentalProviders } from '@/lib/integrations/opendental/scheduling'

export const dynamic = 'force-dynamic'

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>
}) {
  const params = await searchParams
  const user = await requireAuthenticatedUser()

  // Require patientId
  if (!params.patientId) {
    redirect('/patients')
  }

  // Practice-specific feature - require practiceId
  if (!user.practiceId) {
    redirect('/patients')
  }
  // TypeScript type narrowing - after the check above, practiceId is guaranteed to be non-null
  const practiceId: string = user.practiceId as string

  // Fetch patient
  const patient = await prisma.patient.findFirst({
    where: {
      id: params.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    redirect('/patients')
  }

  const scheduling = await getSchedulingSettings(practiceId)

  if (!canBookAppointments(scheduling)) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Schedule Appointment</h1>
          <p className="text-sm text-gray-500">Booking is disabled for this practice</p>
        </div>
        <div className="max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          Appointment booking is turned off in Settings → Scheduling. Availability may still be
          checked from{' '}
          {resolveReadSource(scheduling) === 'open_dental' ? 'Open Dental' : 'Cal.com'}
          , but new visits cannot be written until a booking destination is configured.
        </div>
      </div>
    )
  }

  if (usesOpenDentalForWrite(scheduling)) {
    let providers: Array<{ provNum: number; name: string }> = []
    try {
      providers = (await listOpenDentalProviders(practiceId))
        .filter((p) => !p.isHidden)
        .map((p) => ({ provNum: p.provNum, name: p.name }))
    } catch (error) {
      console.error('[NewAppointmentPage] Failed to load Open Dental providers:', error)
    }
    const timeZone = await getPracticeTimeZone(practiceId)
    const linkedToOpenDental = patient.externalEhrId?.startsWith('opendental:') ?? false

    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Schedule Appointment</h1>
          <p className="text-sm text-gray-500">Book directly into the Open Dental schedule</p>
        </div>
        {linkedToOpenDental ? (
          <OpenDentalScheduleForm
            patientId={patient.id}
            patient={{ id: patient.id, name: patient.name, email: patient.email, phone: patient.phone }}
            providers={providers}
            timeZone={timeZone}
            defaultProvNum={scheduling.defaultProvNum ?? null}
            defaultLengthMinutes={scheduling.defaultLengthMinutes ?? null}
          />
        ) : (
          <div className="max-w-2xl rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            This patient is not linked to Open Dental yet, so they cannot be booked into the Open
            Dental schedule. Sync or link the patient to Open Dental first.
          </div>
        )}
      </div>
    )
  }

  // Fetch event type mappings
  const eventTypeMappings = await prisma.calEventTypeMapping.findMany({
    where: {
      practiceId,
    },
    orderBy: {
      visitTypeName: 'asc',
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Schedule Appointment</h1>
        <p className="text-sm text-gray-500">Book a new appointment</p>
      </div>
      <ScheduleAppointmentForm
        patientId={patient.id}
        patient={{
          id: patient.id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
        }}
        eventTypeMappings={eventTypeMappings.map(m => ({
          id: m.id,
          visitTypeName: m.visitTypeName,
          calEventTypeId: m.calEventTypeId,
        }))}
      />
    </div>
  )
}

