import { inngest } from '../client'
import { prisma } from '@/lib/db'
import { evaluateConditions } from '@/automations/condition-evaluator'
import { runAction } from '@/automations/action-runner'

/**
 * Substitute variables in action args (e.g., {appointment.patientId} -> actual value)
 */
function substituteVariables(args: any, eventData: Record<string, any>): any {
  if (typeof args === 'string') {
    // Replace {variable.path} with actual values
    return args.replace(/\{([^}]+)\}/g, (match, path) => {
      const keys = path.split('.')
      let value: any = eventData
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key]
        } else {
          return match // Return original if path not found
        }
      }
      return value !== undefined && value !== null ? String(value) : match
    })
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

        return { outboxEvent, matchingRules }
      }
    )

    // Step 2: Evaluate conditions for each rule
    const evaluatedRules = await step.run(
      'evaluate-conditions',
      async () => {
        const results = []
        for (const rule of matchingRules) {
          try {
            const matches = evaluateConditions(
              rule.conditionsJson as any,
              payload.data
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
            const actionResults = []

            // Execute actions sequentially
            for (const action of actions) {
              try {
                // Substitute variables in action args (e.g., {appointment.patientId} -> actual value)
                const processedArgs = substituteVariables(action.args || {}, payload.data)
                
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

                actionResults.push({
                  actionType: action.type,
                  status: result.status,
                  result: result.result,
                  error: result.error,
                })
              } catch (error) {
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

