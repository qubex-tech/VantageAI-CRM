import { prisma } from '@/lib/db'
import { getChannelAdapter } from './adapters'
import { recordCommunicationAudit } from './audit'
import type { CommunicationEventPayload, TriggerAction } from './types'

function getVar(path: string, data: Record<string, any>) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), data)
}

export function evaluateJsonLogic(rule: any, data: Record<string, any>): boolean {
  if (rule === null || rule === undefined) {
    return false
  }
  if (typeof rule !== 'object') {
    return Boolean(rule)
  }

  const operator = Object.keys(rule)[0]
  const values = rule[operator]

  switch (operator) {
    case 'var': {
      if (typeof values === 'string') {
        return Boolean(getVar(values, data))
      }
      if (Array.isArray(values)) {
        const [path, fallback] = values
        const resolved = getVar(path, data)
        return resolved === undefined ? fallback : resolved
      }
      return false
    }
    case '==':
      return evaluateJsonLogic(values[0], data) === evaluateJsonLogic(values[1], data)
    case '!=':
      return evaluateJsonLogic(values[0], data) !== evaluateJsonLogic(values[1], data)
    case '>':
      return evaluateJsonLogic(values[0], data) > evaluateJsonLogic(values[1], data)
    case '>=':
      return evaluateJsonLogic(values[0], data) >= evaluateJsonLogic(values[1], data)
    case '<':
      return evaluateJsonLogic(values[0], data) < evaluateJsonLogic(values[1], data)
    case '<=':
      return evaluateJsonLogic(values[0], data) <= evaluateJsonLogic(values[1], data)
    case 'and':
      return values.every((value: any) => Boolean(evaluateJsonLogic(value, data)))
    case 'or':
      return values.some((value: any) => Boolean(evaluateJsonLogic(value, data)))
    case '!':
      return !evaluateJsonLogic(values, data)
    case 'in': {
      const item = evaluateJsonLogic(values[0], data)
      const array = evaluateJsonLogic(values[1], data)
      return Array.isArray(array) ? array.includes(item) : false
    }
    default:
      return false
  }
}

async function executeTriggerAction(action: TriggerAction, event: CommunicationEventPayload) {
  const { practiceId, conversationId, patientId } = event

  switch (action.type) {
    case 'assign_to_team': {
      const teamId = String(action.params.teamId || '')
      if (!teamId) return
      const created = await prisma.communicationAssignment.create({
        data: {
          practiceId,
          conversationId,
          assignedTeamId: teamId,
          status: 'active',
        },
      })
      if (event.actorUserId) {
        await recordCommunicationAudit({
          practiceId,
          userId: event.actorUserId,
          action: 'assign',
          resourceType: 'conversation',
          resourceId: conversationId,
          metadata: {
            assignmentId: created.id,
            assigneeType: 'team',
            assigneeId: teamId,
          },
        }).catch(() => null)
      }
      return
    }
    case 'assign_to_user': {
      const userId = String(action.params.userId || '')
      if (!userId) return
      const created = await prisma.communicationAssignment.create({
        data: {
          practiceId,
          conversationId,
          assignedUserId: userId,
          status: 'active',
        },
      })
      if (event.actorUserId) {
        await recordCommunicationAudit({
          practiceId,
          userId: event.actorUserId,
          action: 'assign',
          resourceType: 'conversation',
          resourceId: conversationId,
          metadata: {
            assignmentId: created.id,
            assigneeType: 'user',
            assigneeId: userId,
          },
        }).catch(() => null)
      }
      return
    }
    case 'send_message': {
      const body = String(action.params.body || '')
      const channel = (action.params.channel || event.channel || 'secure') as any
      if (!body) return

      const patient = await prisma.patient.findFirst({
        where: { id: patientId, practiceId },
        select: {
          primaryPhone: true,
          phone: true,
          email: true,
        },
      })

      if (!patient) return

      const adapter = getChannelAdapter(channel)
      const recipient = {
        phone: patient.primaryPhone || patient.phone,
        email: patient.email,
      }
      if (!adapter.validateRecipient(recipient)) return

      const result = await adapter.sendMessage({
        practiceId,
        conversationId,
        patientId,
        channel,
        body,
        recipient,
      })

      const created = await prisma.communicationMessage.create({
        data: {
          practiceId,
          conversationId,
          patientId,
          direction: 'outbound',
          type: 'message',
          body,
          channel,
          deliveryStatus: result.status,
          metadata: result.metadata,
        },
      })
      if (event.actorUserId) {
        await recordCommunicationAudit({
          practiceId,
          userId: event.actorUserId,
          action: 'message_sent',
          resourceType: 'conversation',
          resourceId: conversationId,
          metadata: {
            messageId: created.id,
            channel,
          },
        }).catch(() => null)
      }
      return
    }
    case 'create_internal_note': {
      const body = String(action.params.body || '')
      if (!body) return
      const created = await prisma.communicationMessage.create({
        data: {
          practiceId,
          conversationId,
          patientId,
          direction: 'internal',
          type: 'note',
          body,
          channel: event.channel || 'secure',
          deliveryStatus: 'sent',
          metadata: {
            triggerGenerated: true,
          },
        },
      })
      if (event.actorUserId) {
        await recordCommunicationAudit({
          practiceId,
          userId: event.actorUserId,
          action: 'note',
          resourceType: 'conversation',
          resourceId: conversationId,
          metadata: {
            messageId: created.id,
          },
        }).catch(() => null)
      }
      return
    }
    default:
      return
  }
}

export async function runCommunicationTriggers(event: CommunicationEventPayload) {
  const triggers = await prisma.communicationTrigger.findMany({
    where: {
      practiceId: event.practiceId,
      eventType: event.type,
      enabled: true,
    },
  })

  const data = {
    event,
  }

  for (const trigger of triggers) {
    const shouldRun = evaluateJsonLogic(trigger.conditionsJson, data)
    if (!shouldRun) continue

    const actions = Array.isArray(trigger.actionsJson) ? (trigger.actionsJson as TriggerAction[]) : []
    for (const action of actions) {
      await executeTriggerAction(action, event)
    }

    if (event.actorUserId) {
      await recordCommunicationAudit({
        practiceId: event.practiceId,
        userId: event.actorUserId,
        action: 'automation',
        resourceType: 'communication_trigger',
        resourceId: trigger.id,
        metadata: {
          conversationId: event.conversationId,
        },
      }).catch(() => null)
    }
  }
}
