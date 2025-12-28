// Type definitions for the application

export interface Practice {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  practiceId: string
  createdAt: Date
  updatedAt: Date
}

export interface Patient {
  id: string
  practiceId: string
  name: string
  dateOfBirth: Date
  phone: string
  email?: string | null
  address?: string | null
  preferredContactMethod: string
  notes?: string | null
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Appointment {
  id: string
  practiceId: string
  patientId: string
  providerId?: string | null
  status: string
  startTime: Date
  endTime: Date
  timezone: string
  visitType: string
  reason?: string | null
  notes?: string | null
  calEventId?: string | null
  calBookingId?: string | null
  createdAt: Date
  updatedAt: Date
}

