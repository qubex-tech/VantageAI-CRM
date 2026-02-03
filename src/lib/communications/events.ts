import type { CommunicationEventPayload, CommunicationEventType } from './types'

type EventHandler = (event: CommunicationEventPayload) => Promise<void> | void

const listeners = new Map<CommunicationEventType, Set<EventHandler>>()

export function onCommunicationEvent(type: CommunicationEventType, handler: EventHandler) {
  const set = listeners.get(type) ?? new Set<EventHandler>()
  set.add(handler)
  listeners.set(type, set)

  return () => {
    set.delete(handler)
  }
}

export async function emitCommunicationEvent(event: CommunicationEventPayload) {
  const set = listeners.get(event.type)
  if (!set || set.size === 0) {
    return
  }
  await Promise.all(Array.from(set).map(async (handler) => handler(event)))
}
