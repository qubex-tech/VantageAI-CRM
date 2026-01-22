import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { evaluateConditions } from '@/automations/condition-evaluator'
import { runAction } from '@/automations/action-runner'

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

function buildAutomationContext(eventData: Record<string, any>) {
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
    patient: {
      ...patient,
      firstName: patient.firstName || inferredFirstName,
      lastName: patient.lastName || inferredLastName,
      preferredName: patient.preferredName || patient.firstName || inferredFirstName,
    },
    appointment: {
      ...appointment,
      date: appointment.date || (appointmentStart ? appointmentStart.toLocaleDateString() : undefined),
      time: appointment.time || (appointmentStart ? appointmentStart.toLocaleTimeString() : undefined),
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

    // Step 2: Evaluate conditions for each rule
    const evaluatedRules = await step.run(
      'evaluate-conditions',
      async () => {
        const results = []
        const automationContext = buildAutomationContext(payload.data)
        for (const rule of matchingRules) {
          try {
            const matches = evaluateConditions(
              rule.conditionsJson as any,
              automationContext
            )
            if (matches) {
              results.push(rule)
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
    const executionResults = await step.run(
      'execute-actions',
      async () => {
        const results = []
        
        for (const rule of evaluatedRules) {
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
            
            const actionResults = []

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
                const automationContext = buildAutomationContext(payload.data)
                let processedArgs = substituteVariables(rawArgs, automationContext)
                
                // Auto-fill patientId from event data if missing and action requires it
                const actionsRequiringPatientId = ['create_note', 'send_email', 'send_sms', 'send_reminder', 'update_patient_fields', 'tag_patient', 'create_insurance_policy']
                if (actionsRequiringPatientId.includes(action.type) && !processedArgs.patientId) {
                  // Try to extract patientId from common event data paths
                  const patientId = 
                    payload.data.appointment?.patientId ||
                    payload.data.patient?.id ||
                    payload.data.patientId ||
                    payload.data.entityId // Fallback to entityId if it's a patient entity
                  
                  if (patientId) {
                    console.log(`[AUTOMATION] Auto-filled patientId from event data:`, patientId)
                    processedArgs = { ...processedArgs, patientId }
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
                },
              },
            })

            results.push({
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

            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        return results
      }
    )

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

