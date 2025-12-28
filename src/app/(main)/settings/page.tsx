import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { CalSettings } from '@/components/settings/CalSettings'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login')
  }

  const integration = await prisma.calIntegration.findUnique({
    where: { practiceId: session.user.practiceId },
    include: {
      eventTypeMappings: true,
    },
  })

  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 md:pt-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">Manage your practice settings</p>
      </div>

      <CalSettings initialIntegration={integration} />
    </div>
  )
}

