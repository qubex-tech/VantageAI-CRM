import { onCommunicationEvent } from './events'
import { runCommunicationTriggers } from './triggers'
import { handleInboundAgent } from './agent'

let initialized = false

export function ensureCommunicationRuntime() {
  if (initialized) return
  initialized = true

  onCommunicationEvent('message.sent', async (event) => {
    await runCommunicationTriggers(event)
  })

  onCommunicationEvent('conversation.assigned', async (event) => {
    await runCommunicationTriggers(event)
  })

  onCommunicationEvent('conversation.resolved', async (event) => {
    await runCommunicationTriggers(event)
  })

  onCommunicationEvent('message.received', async (event) => {
    await runCommunicationTriggers(event)
    if (event.messageId && event.actorUserId && event.channel && event.metadata?.body) {
      await handleInboundAgent({
        practiceId: event.practiceId,
        userId: event.actorUserId,
        conversationId: event.conversationId,
        patientId: event.patientId,
        messageId: event.messageId,
        channel: event.channel,
        body: String(event.metadata.body),
      })
    }
  })
}
