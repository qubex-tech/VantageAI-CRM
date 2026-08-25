import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { evaluateConditions } from '@/automations/condition-evaluator'
import { runAction } from '@/automations/action-runner'
import { logAutomationActivity } from '@/lib/patient-activity'
import { notifyPracticeAutomationRun } from '@/automations/automation-push-notification'

const DEFAULT_OUTREACH_COOLDOWN_HOURS = 24
const DEDUPABLE_NOTIFICATION_ACTIONS = new Set([
  'send_sms',
  'send_email',
  'send_reminder',
  'trigger_curogram_template',
])

function resolveCooldownHours(actionArgs: Record<string, unknown>): number {
  const raw = actionArgs.cooldownHours ?? actionArgs.dedupeWindowHours
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 24 * 30)
  }
  return DEFAULT_OUTREACH_COOLDOWN_HOURS
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  if (typeof value === 'number') return value === 1
  return false
}

function normalizeActionId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function findPriorSuccessfulAction(params: {
  practiceId: string
  ruleId: string
  actionType: string
  patientId: string
  withinHours?: number
  actionId?: string
}) {
  const since =
    typeof params.withinHours === 'number'
      ? new Date(Date.now() - params.withinHours * 60 * 60 * 1000)
      : null
  return prisma.automationActionLog.findFirst({
    where: {
      practiceId: params.practiceId,
      actionType: params.actionType,
      status: 'succeeded',
      ...(since ? { createdAt: { gte: since } } : {}),
      run: {
        ruleId: params.ruleId,
      },
      actionArgs: {
        path: ['patientId'],
        equals: params.patientId,
      },
      ...(params.actionId
        ? {
            AND: [
              {
                actionArgs: {
                  path: ['actionId'],
                  equals: params.actionId,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      runId: true,
    },
  })
}

/**
 * Substitute variables in action args (e.g., {appointment.patientId} or {{patient.firstName}})
 */
function substituteVariables(args: any, eventData: Record<string, any>): any {
  const resolvePath = (rawPath: string, match: string) => {
    const path = String(rawPath).trim()
    const keys = path.split('.')
    let value: any = eventData
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        console.warn(`[AUTOMATION] Variable not found: ${path} in eventData`, {
          path,
          availableKeys: Object.keys(eventData),
          eventData,
        })
        return match // Return original if path not found
      }
    }
    const finalValue = value !== undefined && value !== null ? String(value) : match
    if (finalValue === match) {
      console.warn(`[AUTOMATION] Variable substitution failed for ${path}, keeping placeholder`)
    }
    return finalValue
  }

  if (typeof args === 'string') {
    // Replace {{variable.path}} (marketing-style) first
    let substituted = args.replace(/\{\{([^}]+)\}\}/g, (match, path) => resolvePath(path, match))
    // Replace {variable.path} (legacy) while avoiding double-brace matches
    substituted = substituted.replace(/(?<!\{)\{([^}]+)\}(?!\})/g, (match, path) => resolvePath(path, match))
    return substituted
  } else if (Array.isArray(args)) {
    return args.map(item => substituteVariables(item, eventData))
  } else if (args && typeof args === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(args)) {
      result[key] = substituteVariables(value, eventData)
    }
    return result
  }
  return args
}

function resolvePatientIdFromPayload(payload: {
  entityType: string
  entityId: string
  data: Record<string, any>
}): string | null {
  const data = payload.data || {}
  const candidates = [
    data.patient?.id,
    data.appointment?.patientId,
    data.insurance?.patientId,
    data.formRequest?.patientId,
    data.message?.patientId,
    data.conversation?.patientId,
    data.patientId,
    payload.entityType === 'patient' ? payload.entityId : null,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

function resolvePatientNameFromPayload(data: Record<string, any>): string | null {
  const patient = data?.patient
  if (!patient || typeof patient !== 'object') return null
  if (typeof patient.name === 'string' && patient.name.trim()) return patient.name.trim()
  const first = typeof patient.firstName === 'string' ? patient.firstName.trim() : ''
  const last = typeof patient.lastName === 'string' ? patient.lastName.trim() : ''
  const combined = `${first} ${last}`.trim()
  return combined || null
}

function summarizeActionResults(
  actionResults: Array<{ actionType: string; status: string; error?: string }>
): string {
  if (actionResults.length === 0) return 'No actions executed.'
  return actionResults
    .map((action) => {
      if (action.status === 'succeeded') return `${action.actionType} succeeded`
      if (action.status === 'skipped') return `${action.actionType} skipped`
      return `${action.actionType} failed${action.error ? `: ${action.error}` : ''}`
    })
    .join('; ')
}

function buildAutomationContext(
  eventData: Record<string, any>,
  practice?: { name?: string | null; phone?: string | null; address?: string | null },
  patientListIds: string[] = [],
  patientFlags: { hasFutureScheduledAppointment?: boolean } = {}
) {
  const patient = eventData.patient || {}
  const appointment = eventData.appointment || {}
  const appointmentStart = appointment.startTime ? new Date(appointment.startTime) : null
  const now = new Date()
  const minutesUntilStart = appointmentStart
    ? Math.round((appointmentStart.getTime() - now.getTime()) / (1000 * 60))
    : undefined
  const hoursUntilStart = typeof minutesUntilStart === 'number'
    ? Math.round(minutesUntilStart / 60)
    : undefined
  const daysUntilStart = typeof hoursUntilStart === 'number'
    ? Math.round(hoursUntilStart / 24)
    : undefined
  const nameParts = typeof patient.name === 'string' ? patient.name.split(' ') : []
  const inferredFirstName = nameParts[0] || ''
  const inferredLastName = nameParts.slice(1).join(' ') || ''

  return {
    ...eventData,
    practice: {
      name: practice?.name,
      phone: practice?.phone,
      address: practice?.address,
    },
    patient: {
      ...patient,
      firstName: patient.firstName || inferredFirstName,
      lastName: patient.lastName || inferredLastName,
      preferredName: patient.preferredName || patient.firstName || inferredFirstName,
      listIds: patientListIds,
      hasFutureScheduledAppointment: Boolean(patientFlags.hasFutureScheduledAppointment),
    },
    appointment: {
      ...appointment,
      date: appointment.date || (appointmentStart ? appointmentStart.toLocaleDateString() : undefined),
      time: appointment.time || (appointmentStart ? appointmentStart.toLocaleTimeString() : undefined),
      location: appointment.location || practice?.address,
      providerName: appointment.providerName || appointment.provider?.name,
      minutesUntilStart,
      hoursUntilStart,
      daysUntilStart,
    },
    links: {
      confirm: '#',
      reschedule: '#',
      cancel: '#',
      ...(eventData.links || {}),
    },
  }
}

/**
 * Event payload structure for crm/event.received
 */
interface EventReceivedPayload {
  clinicId: string // practiceId in our system (kept as clinicId for compatibility with outbox payload)
  eventName: string
  entityType: string
  entityId: string
  data: Record<string, any>
  occurredAt: string
  sourceEventId: string // OutboxEvent.id
}

/**
 * Main automation function triggered by crm/event.received
 * 
 * Flow:
 * 1. Load OutboxEvent payload and matching AutomationRules
 * 2. Evaluate conditions for each rule
 * 3. For each matching rule, execute actions sequentially
 * 4. Mark runs as succeeded/failed
 */
export const runAutomationsForEvent = inngest.createFunction(
  {
    id: 'run-automations-for-event',
    name: 'Run Automations for Event',
    retries: 3,
  },
  { event: 'crm/event.received' },
  async ({ event, step }) => {
    const payload = event.data as EventReceivedPayload
    const practiceId = payload.clinicId

    // Step 1: Load event and matching rules
    const { outboxEvent, matchingRules } = await step.run(
      'load-event-and-rules',
      async () => {
        const outboxEvent = await prisma.outboxEvent.findUnique({
          where: { id: payload.sourceEventId },
        })

        if (!outboxEvent) {
          throw new Error(`OutboxEvent ${payload.sourceEventId} not found`)
        }

        const matchingRules = await prisma.automationRule.findMany({
          where: {
            practiceId,
            enabled: true,
            triggerEvent: payload.eventName,
          },
        })

        // Debug: Log the rules and their actions
        console.log(`[AUTOMATION] Found ${matchingRules.length} matching rules`)
        matchingRules.forEach((rule) => {
          console.log(`[AUTOMATION] Rule ${rule.id} (${rule.name}):`, {
            triggerEvent: rule.triggerEvent,
            actionsCount: Array.isArray(rule.actionsJson) ? rule.actionsJson.length : 0,
            actions: rule.actionsJson,
            actionsDetails: Array.isArray(rule.actionsJson) ? rule.actionsJson.map((a: any) => ({
              type: a.type,
              args: a.args,
              argsKeys: Object.keys(a.args || {}),
              argsType: typeof a.args,
            })) : [],
          })
        })

        return { outboxEvent, matchingRules }
      }
    )

    const practice = await step.run('load-practice', async () => {
      return prisma.practice.findUnique({
        where: { id: practiceId },
        select: { name: true, phone: true, address: true },
      })
    })

    const patientContext = await step.run('load-patient-condition-context', async () => {
      const patientId =
        payload.data.patient?.id ||
        payload.data.appointment?.patientId ||
        payload.data.patientId ||
        (payload.entityType === 'patient' ? payload.entityId : null)

      if (!patientId) {
        return {
          patientId: null as string | null,
          listIds: [] as string[],
        }
      }

      const memberships = await prisma.patientListMember.findMany({
        where: {
          practiceId,
          patientId,
        },
        select: { listId: true },
      })

      return {
        patientId,
        listIds: memberships.map((m) => m.listId),
      }
    })

    // Step 2: Evaluate conditions for each rule
    const evaluatedRules = await step.run(
      'evaluate-conditions',
      async () => {
        const results = []
        const {
          extractScheduledAppointmentLookahead,
          patientHasFutureScheduledAppointment,
        } = await import('@/automations/patient-future-appointment')
        const appointmentCheckCache = new Map<string, boolean>()

        for (const rule of matchingRules) {
          try {
            const lookahead = extractScheduledAppointmentLookahead(rule.conditionsJson)
            let hasFutureScheduledAppointment = false
            if (lookahead.used && patientContext.patientId) {
              const cacheKey = lookahead.withinDays == null ? 'any' : String(lookahead.withinDays)
              const cached = appointmentCheckCache.get(cacheKey)
              if (cached != null) {
                hasFutureScheduledAppointment = cached
              } else {
                hasFutureScheduledAppointment = await patientHasFutureScheduledAppointment({
                  practiceId,
                  patientId: patientContext.patientId,
                  withinDays: lookahead.withinDays,
                })
                appointmentCheckCache.set(cacheKey, hasFutureScheduledAppointment)
              }
            }
            const automationContext = buildAutomationContext(
              payload.data,
              practice || undefined,
              patientContext.listIds,
              { hasFutureScheduledAppointment }
            )
            const matches = evaluateConditions(
              rule.conditionsJson as any,
              automationContext
            )
            if (matches) {
              results.push({ rule, hasFutureScheduledAppointment })
            }
          } catch (error) {
            console.error(`Error evaluating rule ${rule.id}:`, error)
            // Continue with other rules even if one fails
          }
        }
        return results
      }
    )

    // Step 3: Execute actions for each matching rule
    const executionResults = []
    const patientId = resolvePatientIdFromPayload(payload)

    for (const { rule, hasFutureScheduledAppointment } of evaluatedRules) {
      // Create AutomationRun
      const run = await prisma.automationRun.create({
        data: {
          practiceId,
          ruleId: rule.id,
          sourceEventId: payload.sourceEventId,
          status: 'running',
        },
      })

      try {
        const actions = rule.actionsJson as any[]
        console.log(`[AUTOMATION] Rule ${rule.id} has ${actions.length} actions to execute`)
        console.log(`[AUTOMATION] Actions from database:`, JSON.stringify(actions, null, 2))

        const actionResults: Array<{
          actionType: string
          status: string
          result?: unknown
          error?: string
        }> = []

        // Execute actions sequentially
        for (const [index, action] of actions.entries()) {
          try {
            console.log(`[AUTOMATION] Executing action: ${action.type}`, {
              ruleId: rule.id,
              runId: run.id,
              actionObject: action,
              originalArgs: action.args,
              originalArgsType: typeof action.args,
              originalArgsKeys: action.args ? Object.keys(action.args) : [],
              actionKeys: Object.keys(action),
              eventData: payload.data,
              eventDataKeys: Object.keys(payload.data),
            })

            // Ensure args is an object
            const rawArgs = action.args || {}
            if (typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
              console.error(`[AUTOMATION] Invalid args structure:`, rawArgs)
              throw new Error(`Action args must be an object, got ${typeof rawArgs}`)
            }

            // Substitute variables in action args (e.g., {appointment.patientId} -> actual value)
            const automationContext = buildAutomationContext(
              payload.data,
              practice || undefined,
              patientContext.listIds,
              {
                hasFutureScheduledAppointment,
              }
            )
            let processedArgs = substituteVariables(rawArgs, automationContext)

            // Auto-fill patientId from event data if missing and action requires it
            const actionsRequiringPatientId = ['create_note', 'send_email', 'send_sms', 'send_reminder', 'update_patient_fields', 'tag_patient', 'create_insurance_policy', 'trigger_curogram_template']
            if (actionsRequiringPatientId.includes(action.type) && !processedArgs.patientId) {
              // Try to extract patientId from common event data paths
              const resolvedPatientId =
                patientId ||
                payload.data.appointment?.patientId ||
                payload.data.patient?.id ||
                payload.data.patientId ||
                payload.data.entityId // Fallback to entityId if it's a patient entity

              if (resolvedPatientId) {
                console.log(`[AUTOMATION] Auto-filled patientId from event data:`, resolvedPatientId)
                processedArgs = { ...processedArgs, patientId: resolvedPatientId }
              } else {
                console.warn(`[AUTOMATION] Could not auto-fill patientId for action ${action.type}. Event data:`, Object.keys(payload.data))
              }
            }

            // Auto-fill type for create_note if missing
            if (action.type === 'create_note' && !processedArgs.type) {
              console.log(`[AUTOMATION] Auto-filling type='general' for create_note`)
              processedArgs = { ...processedArgs, type: 'general' }
            }

            console.log(`[AUTOMATION] Processed args after variable substitution:`, {
              processedArgs,
              processedArgsKeys: Object.keys(processedArgs),
              processedArgsValues: Object.entries(processedArgs).map(([k, v]) => ({
                key: k,
                value: v,
                valueType: typeof v,
                isEmpty: v === '' || v === null || v === undefined,
              })),
            })

            if (action.type === 'delay_seconds') {
              const delaySeconds = typeof processedArgs.seconds === 'number'
                ? processedArgs.seconds
                : Number(processedArgs.seconds)
              if (!Number.isNaN(delaySeconds) && delaySeconds > 0) {
                await step.sleep(
                  `delay-${run.id}-${index}`,
                  `${delaySeconds}s`
                )
              }
            }

            if (action.type === 'wait_until_local_time') {
              const { getPracticeTimeZone } = await import('@/lib/practice-timezone')
              const { msUntilLocalTime } = await import(
                '@/lib/appointment-optimization/waitUntilLocalTime'
              )
              const hour =
                typeof processedArgs.hour === 'number'
                  ? processedArgs.hour
                  : Number(processedArgs.hour)
              const minute =
                typeof processedArgs.minute === 'number'
                  ? processedArgs.minute
                  : Number(processedArgs.minute ?? 0)
              if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
                const timeZone = await getPracticeTimeZone(practiceId)
                const waitMs = msUntilLocalTime({
                  hour,
                  minute: Number.isNaN(minute) ? 0 : minute,
                  timeZone,
                })
                if (waitMs > 0) {
                  await step.sleep(
                    `wait-until-${run.id}-${index}`,
                    `${Math.ceil(waitMs / 1000)}s`
                  )
                }
              }
            }

            if (action.type === 'wait_until_send_window') {
              const { getPracticeTimeZone } = await import('@/lib/practice-timezone')
              const { msUntilSendWindow } = await import(
                '@/lib/appointment-optimization/waitUntilLocalTime'
              )
              const startHour =
                typeof processedArgs.startHour === 'number'
                  ? processedArgs.startHour
                  : Number(processedArgs.startHour)
              const startMinute =
                typeof processedArgs.startMinute === 'number'
                  ? processedArgs.startMinute
                  : Number(processedArgs.startMinute ?? 0)
              const endHour =
                typeof processedArgs.endHour === 'number'
                  ? processedArgs.endHour
                  : Number(processedArgs.endHour)
              const endMinute =
                typeof processedArgs.endMinute === 'number'
                  ? processedArgs.endMinute
                  : Number(processedArgs.endMinute ?? 0)
              const daysOfWeek = Array.isArray(processedArgs.daysOfWeek)
                ? processedArgs.daysOfWeek
                    .map((d: unknown) => Number(d))
                    .filter((d: number) => Number.isFinite(d) && d >= 0 && d <= 6)
                : undefined
              if (
                !Number.isNaN(startHour) &&
                startHour >= 0 &&
                startHour <= 23 &&
                !Number.isNaN(endHour) &&
                endHour >= 0 &&
                endHour <= 23
              ) {
                const timeZone = await getPracticeTimeZone(practiceId)
                const waitMs = msUntilSendWindow({
                  startHour,
                  startMinute: Number.isNaN(startMinute) ? 0 : startMinute,
                  endHour,
                  endMinute: Number.isNaN(endMinute) ? 0 : endMinute,
                  daysOfWeek,
                  timeZone,
                })
                if (waitMs > 0) {
                  await step.sleep(
                    `wait-send-window-${run.id}-${index}`,
                    `${Math.ceil(waitMs / 1000)}s`
                  )
                }
              }
            }

            // Avoid bombarding the same patient with repeat outreach when a list is re-run.
            if (DEDUPABLE_NOTIFICATION_ACTIONS.has(action.type)) {
              const actionPatientId =
                typeof processedArgs.patientId === 'string' ? processedArgs.patientId.trim() : ''
              if (actionPatientId) {
                const isCurogramTemplateAction = action.type === 'trigger_curogram_template'
                const preventDuplicatesForever =
                  isCurogramTemplateAction && parseBoolean(processedArgs.preventDuplicateActions)
                const cooldownHours = resolveCooldownHours(processedArgs)
                const normalizedActionId = normalizeActionId(processedArgs.actionId)

                const recent = await findPriorSuccessfulAction({
                  practiceId,
                  ruleId: rule.id,
                  actionType: action.type,
                  patientId: actionPatientId,
                  ...(preventDuplicatesForever ? {} : { withinHours: cooldownHours }),
                  ...(isCurogramTemplateAction && normalizedActionId
                    ? { actionId: normalizedActionId }
                    : {}),
                })

                if (recent) {
                  const reasonSuffix = preventDuplicatesForever
                    ? `already succeeded before (run ${recent.runId}).`
                    : `already succeeded within ${cooldownHours}h (run ${recent.runId}).`
                  const actionIdSuffix =
                    isCurogramTemplateAction && normalizedActionId
                      ? ` for actionId ${normalizedActionId}`
                      : ''
                  const skipReason = `Skipped duplicate outreach: ${action.type}${actionIdSuffix} for patient ${actionPatientId} ${reasonSuffix}`

                  await prisma.automationActionLog.create({
                    data: {
                      runId: run.id,
                      practiceId,
                      actionType: action.type,
                      actionArgs: processedArgs,
                      actionResult: {
                        skippedByCooldown: !preventDuplicatesForever,
                        skippedByDuplicateFlag: preventDuplicatesForever,
                        ...(preventDuplicatesForever ? {} : { cooldownHours }),
                        ...(normalizedActionId ? { actionId: normalizedActionId } : {}),
                        priorRunId: recent.runId,
                        priorActionLogId: recent.id,
                        priorSentAt: recent.createdAt.toISOString(),
                      },
                      status: 'skipped',
                      error: skipReason,
                    },
                  })
                  actionResults.push({
                    actionType: action.type,
                    status: 'skipped',
                    error: skipReason,
                  })
                  continue
                }
              }
            }

            const result = await runAction({
              practiceId,
              runId: run.id,
              actionType: action.type,
              actionArgs: processedArgs,
              eventData: {
                ...payload.data,
                userId: rule.createdByUserId, // Pass rule creator as userId for actions
              },
            })

            console.log(`[AUTOMATION] Action result:`, {
              actionType: action.type,
              status: result.status,
              result: result.result,
              error: result.error,
            })

            actionResults.push({
              actionType: action.type,
              status: result.status,
              result: result.result,
              error: result.error,
            })
          } catch (error) {
            console.error(`[AUTOMATION] Action execution error:`, {
              actionType: action.type,
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
            })
            actionResults.push({
              actionType: action.type,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        // Mark run as succeeded
        await prisma.automationRun.update({
          where: { id: run.id },
          data: {
            status: 'succeeded',
            finishedAt: new Date(),
            result: {
              actionsExecuted: actionResults.length,
              actionResults,
            } as any,
          },
        })

        if (patientId) {
          await step.run(`log-activity-${rule.id}-${payload.sourceEventId}`, async () => {
            await logAutomationActivity({
              patientId,
              ruleId: rule.id,
              ruleName: rule.name,
              triggerEvent: payload.eventName,
              runId: run.id,
              status: 'succeeded',
              description: `Triggered by ${payload.eventName}. ${summarizeActionResults(actionResults)}`,
              metadata: {
                sourceEventId: payload.sourceEventId,
                actionsExecuted: actionResults.length,
                actionResults,
              },
            })
          })
        } else {
          console.warn(
            `[AUTOMATION] Skipping activity feed log for run ${run.id}: no patientId on event ${payload.eventName}`
          )
        }

        await step.run(`push-automation-${rule.id}-${payload.sourceEventId}`, async () => {
          await notifyPracticeAutomationRun({
            practiceId,
            ruleId: rule.id,
            ruleName: rule.name,
            triggerEvent: payload.eventName,
            runId: run.id,
            status: 'succeeded',
            patientId,
            patientName: resolvePatientNameFromPayload(payload.data),
            actionResults,
          })
        })

        executionResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'succeeded',
          actionsExecuted: actionResults.length,
        })
      } catch (error) {
        // Mark run as failed
        await prisma.automationRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })

        if (patientId) {
          await step.run(`log-activity-failed-${rule.id}-${payload.sourceEventId}`, async () => {
            await logAutomationActivity({
              patientId,
              ruleId: rule.id,
              ruleName: rule.name,
              triggerEvent: payload.eventName,
              runId: run.id,
              status: 'failed',
              description: `Triggered by ${payload.eventName}. ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              metadata: {
                sourceEventId: payload.sourceEventId,
              },
            })
          })
        }

        await step.run(`push-automation-failed-${rule.id}-${payload.sourceEventId}`, async () => {
          await notifyPracticeAutomationRun({
            practiceId,
            ruleId: rule.id,
            ruleName: rule.name,
            triggerEvent: payload.eventName,
            runId: run.id,
            status: 'failed',
            patientId,
            patientName: resolvePatientNameFromPayload(payload.data),
          })
        })

        executionResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      summary: {
        totalRules: matchingRules.length,
        matchedRules: evaluatedRules.length,
        executedRules: executionResults.length,
        results: executionResults,
      },
    }
  }
)

