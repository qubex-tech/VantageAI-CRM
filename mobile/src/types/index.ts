// ─────────────────────────────────────────────────────────────────────────────
// Shared types mirroring the backend Prisma models (lean, mobile-safe subset)
// ─────────────────────────────────────────────────────────────────────────────

export type Channel = 'sms' | 'email' | 'secure' | 'voice' | 'video'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'read'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  practiceId: string | null
  role: string
}

export interface AuthState {
  user: AuthUser | null
  token: string | null
}

// ─── Conversations / Inbox ────────────────────────────────────────────────────

export interface PatientSummary {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  primaryPhone: string | null
  email: string | null
}

export interface MessageSummary {
  id: string
  body: string | null
  direction: MessageDirection
  channel: Channel
  createdAt: string
  readAt: string | null
  deliveryStatus: DeliveryStatus | null
}

export interface ConversationAssignment {
  id: string
  status: 'active' | 'pending' | 'resolved'
  assignedUserId: string | null
  assignedTeamId: string | null
}

export interface Conversation {
  id: string
  channel: Channel
  status: ConversationStatus
  subject: string | null
  lastMessageAt: string | null
  createdAt: string
  patient: PatientSummary | null
  latestMessage: MessageSummary | null
  unreadCount: number
  assignments: ConversationAssignment[]
}

export interface Message {
  id: string
  conversationId: string
  body: string | null
  direction: MessageDirection
  channel: Channel
  type: 'message' | 'note' | 'system'
  deliveryStatus: DeliveryStatus | null
  readAt: string | null
  createdAt: string
  authorId: string | null
  authorName: string | null
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface MobileNotification {
  id: string
  type: 'message'
  conversationId: string
  channel: Channel
  conversationStatus: ConversationStatus
  patientId: string | null
  patientName: string
  patientPhone: string | null
  patientEmail: string | null
  unreadCount: number
  preview: string | null
  latestMessageAt: string | null
  lastMessageAt: string | null
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
  count: number
}

export interface NotificationsResponse {
  notifications: MobileNotification[]
  nextCursor: string | null
  count: number
}

export interface ConversationsResponse {
  conversations: Conversation[]
  nextCursor?: string | null
}

export interface MessagesResponse {
  messages: Message[]
}

export interface SendMessagePayload {
  conversationId?: string
  patientId: string
  channel: Channel
  body: string
  subject?: string
}
