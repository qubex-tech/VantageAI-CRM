export interface User {
  id: string
  email: string
  name: string | null
  practiceId: string | null
  role: string
}

export interface Patient {
  id: string
  practiceId: string
  name: string
  dateOfBirth: string
  phone: string
  primaryPhone?: string | null
  email?: string | null
  address?: string | null
  preferredContactMethod: string
  notes?: string | null
  createdAt: string
  updatedAt: string
  tags?: PatientTag[]
  _count?: {
    appointments: number
    insurancePolicies: number
  }
}

export interface PatientTag {
  id: string
  name: string
  color?: string | null
}

export interface Appointment {
  id: string
  practiceId: string
  patientId: string
  patient?: Pick<Patient, 'id' | 'name' | 'phone'>
  providerId?: string | null
  status: AppointmentStatus
  startTime: string
  endTime: string
  timezone: string
  visitType: string
  reason?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'

export interface Task {
  id: string
  practiceId: string
  patientId?: string | null
  patient?: Pick<Patient, 'id' | 'name'> | null
  assignedTo?: string | null
  assignee?: Pick<User, 'id' | 'name'> | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  category?: string | null
  dueDate?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    comments: number
  }
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TaskComment {
  id: string
  taskId: string
  userId: string
  author?: Pick<User, 'id' | 'name'>
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  practiceId: string
  patientId?: string | null
  patient?: Pick<Patient, 'id' | 'name'> | null
  channel: ConversationChannel
  status: ConversationStatus
  subject?: string | null
  assigneeId?: string | null
  assignee?: Pick<User, 'id' | 'name'> | null
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export type ConversationChannel = 'sms' | 'email' | 'secure' | 'voice' | 'video'
export type ConversationStatus = 'open' | 'pending' | 'resolved'

export interface Message {
  id: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  channel: ConversationChannel
  content: string
  fromAddress?: string | null
  toAddress?: string | null
  status?: string | null
  sentAt?: string | null
  createdAt: string
}

export interface PatientNote {
  id: string
  patientId: string
  authorId: string
  author?: Pick<User, 'id' | 'name'>
  content: string
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  totalPatients: number
  todayAppointments: number
  pendingTasks: number
  openConversations: number
}
