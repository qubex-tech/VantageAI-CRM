import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { BackButton } from '@/components/portal/BackButton'
import { PortalForm } from '@/components/portal/PortalForm'

export const dynamic = 'force-dynamic'

export default async function PortalFormPage({ params }: { params: { id: string } }) {
  const session = await getPatientSession()

  if (!session) {
    redirect('/portal/auth')
  }

  const request = await prisma.formRequest.findFirst({
    where: {
      id: params.id,
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    include: {
      template: true,
    },
  })

  if (!request) {
    redirect('/portal')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">{request.template.name}</h1>
            {request.template.description && (
              <p className="text-sm text-gray-600 mt-1">{request.template.description}</p>
            )}
          </div>
          <PortalForm patientId={session.patientId} request={request as any} />
        </div>
      </div>
    </div>
  )
}
