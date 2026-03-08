import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { refreshBackendConnection } from '@/lib/integrations/ehr/backendTokens'

const SCHEDULE_CRON = '*/10 * * * *'
const REFRESH_WINDOW_MINUTES = 10

export const refreshEhrBackendTokens = inngest.createFunction(
  {
    id: 'refresh-ehr-backend-tokens',
    name: 'Refresh EHR Backend Tokens',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    const now = new Date()
    const refreshBefore = new Date(now.getTime() + REFRESH_WINDOW_MINUTES * 60 * 1000)

    const connections = await step.run('load-backend-connections', async () => {
      return prisma.ehrConnection.findMany({
        where: {
          authFlow: 'backend_services',
          status: 'connected',
          accessTokenEnc: { not: null },
          OR: [
            { expiresAt: null },
            { expiresAt: { lte: refreshBefore } },
          ],
        },
      })
    })

    if (connections.length === 0) {
      return { refreshed: 0 }
    }

    let refreshed = 0
    for (const connection of connections) {
      await step.run(`refresh-${connection.id}`, async () => {
        try {
          const fresh = await prisma.ehrConnection.findUnique({
            where: { id: connection.id },
          })
          if (!fresh) {
            return
          }
          await refreshBackendConnection({ connection: fresh, now })
          refreshed += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await prisma.ehrConnection.update({
            where: { id: connection.id },
            data: { status: 'error' },
          })
          console.error('[EHR] Failed to refresh backend token', {
            connectionId: connection.id,
            providerId: connection.providerId,
            tenantId: connection.tenantId,
            error: message,
          })
        }
      })
    }

    return { refreshed }
  }
)
