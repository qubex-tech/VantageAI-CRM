import { z } from 'zod'

// Patient schemas
export const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dateOfBirth: z.coerce.date(),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  preferredContactMethod: z.enum(['phone', 'email', 'sms', 'mail']),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const insurancePolicySchema = z.object({
  providerName: z.string().min(1, 'Provider name is required'),
  planName: z.string().optional(),
  memberId: z.string().min(1, 'Member ID is required'),
  groupId: z.string().optional(),
  policyHolderName: z.string().min(1, 'Policy holder name is required'),
  policyHolderPhone: z.string().optional(),
  eligibilityStatus: z.enum(['active', 'inactive', 'pending', 'unknown']),
})

// Appointment schemas
export const appointmentSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  timezone: z.string(),
  visitType: z.string().min(1, 'Visit type is required'),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

export const bookAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  eventTypeId: z.string().min(1, 'Event type ID is required'),
  startTime: z.string(), // ISO string
  timezone: z.string().optional(),
  reason: z.string().optional(),
})

// Cal.com integration schemas
export const calIntegrationSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  calOrganizationId: z.string().optional(),
  calTeamId: z.string().optional(),
})

export const calEventTypeMappingSchema = z.object({
  visitTypeName: z.string().min(1, 'Visit type name is required'),
  calEventTypeId: z.string().min(1, 'Cal event type ID is required'),
})

// RetellAI webhook schemas
export const retellWebhookSchema = z.object({
  event: z.string(),
  call: z.any().optional(),
  transcript: z.any().optional(),
  tool_calls: z.array(z.any()).optional(),
})

// Agent action schemas
export const findOrCreatePatientSchema = z.object({
  phone: z.string().min(10),
  name: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email().optional(),
})

export const getAvailableSlotsSchema = z.object({
  eventTypeId: z.string().min(1),
  dateFrom: z.string(),
  dateTo: z.string(),
  timezone: z.string(),
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

