export type ConversationView = 'Open' | 'Pending' | 'Resolved' | 'Mine' | 'Team'

export interface Conversation {
  id: string
  patientName: string
  patientEmail?: string | null
  patientPhone?: string | null
  lastMessageAt?: string | null
  lastMessageSnippet: string
  channel: string
  unread: boolean
  updatedAt: string
  status: string
  assignee: string | null
}

export interface Message {
  id: string
  senderType: 'patient' | 'staff' | 'system'
  body: string
  createdAt: string
  isInternalNote: boolean
  channel: 'sms' | 'email' | 'secure' | 'voice' | 'video' | string
}
