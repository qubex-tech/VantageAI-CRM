export type CommunicationChannel = 'sms' | 'secure' | 'voice' | 'video'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageType = 'message' | 'note' | 'system'
export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed'
export type AssignmentStatus = 'active' | 'pending' | 'resolved'

export type CommunicationEventType =
  | 'message.received'
  | 'message.sent'
  | 'conversation.assigned'
  | 'conversation.resolved'

export interface CommunicationEventPayload {
  type: CommunicationEventType
  practiceId: string
  conversationId: string
  patientId: string
  actorUserId?: string
  messageId?: string
  assignmentId?: string
  channel?: CommunicationChannel
  metadata?: Record<string, unknown>
}

export interface AdapterSendInput {
  practiceId: string
  conversationId: string
  patientId: string
  channel: CommunicationChannel
  body: string
  recipient: {
    phone?: string | null
    email?: string | null
  }
  attachments?: Array<{
    fileName: string
    mimeType?: string | null
    fileSize?: number | null
    storageKey: string
    url?: string | null
  }>
}

export interface AdapterSendResult {
  status: DeliveryStatus
  providerMessageId?: string
  metadata?: Record<string, unknown>
}

export interface ChannelAdapter {
  channel: CommunicationChannel
  supportsAttachments: boolean
  validateRecipient: (recipient: AdapterSendInput['recipient']) => boolean
  sendMessage: (input: AdapterSendInput) => Promise<AdapterSendResult>
}

export type TriggerActionType =
  | 'assign_to_team'
  | 'assign_to_user'
  | 'send_message'
  | 'create_internal_note'

export interface TriggerAction {
  type: TriggerActionType
  params: Record<string, unknown>
}
