import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { decryptString } from '@/lib/integrations/ehr/crypto'
import { refreshBackendConnectionIfNeeded } from '@/lib/integrations/ehr/backendTokens'
import { logEhrAudit } from '@/lib/integrations/ehr/audit'
import type { EhrSettings } from '@/lib/integrations/ehr/types'

const PROVIDER_ID = 'ecw_bulk'
const SCHEDULE_CRON = '0 * * * *'
const CHECK_DELAY_MS = 60 * 60 * 1000
const CHICAGO_TIMEZONE = 'America/Chicago'

type ProviderConfig = {
  orgId?: string
  groupId?: string
}

function inferOrgId(fhirBaseUrl: string) {
  const trimmed = fhirBaseUrl.replace(/\/+$/g, '')
  return trimmed.split('/').pop() || ''
}

function buildBulkBaseUrl(baseUrl: string, orgId: string) {
  const trimmed = baseUrl.replace(/\/+$/g, '')
  return trimmed.endsWith(`/${orgId}`) ? trimmed.slice(0, -1 * (orgId.length + 1)) : trimmed
}

function buildExportUrl(baseUrl: string, orgId: string, groupId: string) {
  const params = new URLSearchParams()
  params.set('_type', 'Patient')
  return `${baseUrl}/${orgId}/Group/${groupId}/$export?${params.toString()}`
}

function isChicagoMidnight(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return hour === 0 && minute === 0
}

async function startBulkExport(params: {
  practiceId: string
  providerConfig: ProviderConfig
  connectionId: string
}) {
  const { practiceId, providerConfig, connectionId } = params
  const connection = await prisma.ehrConnection.findUnique({ where: { id: connectionId } })
  if (!connection?.accessTokenEnc) {
    throw new Error('No backend services connection available')
  }
  const refreshed = await refreshBackendConnectionIfNeeded({ connection })
  const accessToken = decryptString(refreshed.accessTokenEnc!)

  const groupId = providerConfig.groupId
  let orgId = providerConfig.orgId
  if (!orgId) {
    orgId = inferOrgId(refreshed.fhirBaseUrl)
  }
  if (!orgId || !groupId) {
    throw new Error('Missing orgId or groupId for bulk export')
  }

  const baseUrl = buildBulkBaseUrl(refreshed.fhirBaseUrl, orgId)
  const exportUrl = buildExportUrl(baseUrl, orgId, groupId)

  const response = await fetch(exportUrl, {
    method: 'GET',
    headers: {
      accept: 'application/fhir+json',
      prefer: 'respond-async',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Bulk export start failed: ${responseText}`)
  }
  const contentLocation = response.headers.get('content-location') || undefined
  const retryAfter = response.headers.get('retry-after') || undefined

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId: null,
    action: 'EHR_BULK_EXPORT_START',
    providerId: refreshed.providerId,
    entity: 'EhrConnection',
    entityId: refreshed.id,
    metadata: {
      orgId,
      groupId,
      exportUrl,
      contentLocation,
      retryAfter,
    },
  })

  return { statusUrl: contentLocation }
}

async function checkBulkStatus(params: {
  practiceId: string
  connectionId: string
  statusUrl: string
}) {
  const { practiceId, connectionId, statusUrl } = params
  const connection = await prisma.ehrConnection.findUnique({ where: { id: connectionId } })
  if (!connection?.accessTokenEnc) {
    throw new Error('No backend services connection available')
  }
  const refreshed = await refreshBackendConnectionIfNeeded({ connection })
  const accessToken = decryptString(refreshed.accessTokenEnc!)

  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  })
  const responseText = await response.text()

  await logEhrAudit({
    tenantId: practiceId,
    actorUserId: null,
    action: 'EHR_BULK_EXPORT_STATUS',
    providerId: refreshed.providerId,
    entity: 'EhrConnection',
    entityId: refreshed.id,
    metadata: {
      statusUrl,
      status: response.status,
    },
  })

  if (response.status === 202) {
    return { status: 'in_progress' as const }
  }
  if (!response.ok) {
    throw new Error(`Bulk export status failed: ${responseText}`)
  }
  const parsed = responseText ? JSON.parse(responseText) : null
  const outputs = Array.isArray(parsed?.output) ? parsed.output : []
  const outputUrls = outputs
    .filter((item: any) => item?.type === 'Patient' && typeof item?.url === 'string')
    .map((item: any) => item.url as string)
  return { status: 'complete' as const, outputUrls }
}

export const runEhrBulkNightly = inngest.createFunction(
  {
    id: 'ehr-bulk-nightly',
    name: 'EHR Bulk Nightly Export',
  },
  { cron: SCHEDULE_CRON },
  async ({ step }) => {
    if (!isChicagoMidnight()) {
      return { skipped: true, reason: 'not_midnight_chicago' }
    }
    const settingsList = await step.run('load-ehr-settings', async () => {
      return prisma.practiceSettings.findMany({
        where: { ehrIntegrations: { not: null } },
        select: { practiceId: true, ehrIntegrations: true },
      })
    })

    const results: Array<{ practiceId: string; status: string }> = []

    for (const settingsRow of settingsList) {
      const settings = settingsRow.ehrIntegrations as EhrSettings | null
      if (!settings?.enableBulkExport || !settings.enabledProviders?.includes(PROVIDER_ID as any)) {
        continue
      }
      const providerConfig =
        (settings.providerConfigs?.[PROVIDER_ID] as ProviderConfig | undefined) || {}
      if (!providerConfig.groupId) {
        results.push({ practiceId: settingsRow.practiceId, status: 'missing_group_id' })
        continue
      }

      const connection = await step.run(`load-connection-${settingsRow.practiceId}`, async () => {
        return prisma.ehrConnection.findFirst({
          where: {
            tenantId: settingsRow.practiceId,
            providerId: PROVIDER_ID,
            authFlow: 'backend_services',
            status: 'connected',
            accessTokenEnc: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
        })
      })
      if (!connection) {
        results.push({ practiceId: settingsRow.practiceId, status: 'missing_connection' })
        continue
      }

      let statusUrl: string | undefined
      try {
        const start = await step.run(`start-export-${settingsRow.practiceId}`, async () => {
          return startBulkExport({
            practiceId: settingsRow.practiceId,
            providerConfig,
            connectionId: connection.id,
          })
        })
        statusUrl = start.statusUrl
      } catch (error) {
        const message = error instanceof Error ? error.message : 'start_failed'
        results.push({ practiceId: settingsRow.practiceId, status: message })
        continue
      }

      if (!statusUrl) {
        results.push({ practiceId: settingsRow.practiceId, status: 'missing_status_url' })
        continue
      }

      const firstCheck = await step.run(`status-1am-${settingsRow.practiceId}`, async () => {
        await step.sleep(`wait-1h-${settingsRow.practiceId}`, CHECK_DELAY_MS)
        return checkBulkStatus({
          practiceId: settingsRow.practiceId,
          connectionId: connection.id,
          statusUrl,
        })
      })

      if (firstCheck.status === 'complete') {
        await inngest.send({
          name: 'ehr/bulk.import',
          data: {
            practiceId: settingsRow.practiceId,
            providerId: PROVIDER_ID,
            outputUrls: firstCheck.outputUrls,
          },
        })
        results.push({ practiceId: settingsRow.practiceId, status: 'import_started' })
        continue
      }

      const secondCheck = await step.run(`status-2am-${settingsRow.practiceId}`, async () => {
        await step.sleep(`wait-2h-${settingsRow.practiceId}`, CHECK_DELAY_MS)
        return checkBulkStatus({
          practiceId: settingsRow.practiceId,
          connectionId: connection.id,
          statusUrl,
        })
      })

      if (secondCheck.status === 'complete') {
        await inngest.send({
          name: 'ehr/bulk.import',
          data: {
            practiceId: settingsRow.practiceId,
            providerId: PROVIDER_ID,
            outputUrls: secondCheck.outputUrls,
          },
        })
        results.push({ practiceId: settingsRow.practiceId, status: 'import_started' })
        continue
      }

      results.push({ practiceId: settingsRow.practiceId, status: 'still_in_progress' })
    }

    return { results }
  }
)
