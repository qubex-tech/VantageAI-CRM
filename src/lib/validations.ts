import { z } from 'zod'

// Patient schemas
export const patientSchema = z.object({
  // Legacy fields (for backward compatibility)
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional().nullable(),
  preferredContactMethod: z.enum(['phone', 'email', 'sms', 'mail']).optional(),
  
  // Basic Information
  externalEhrId: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  preferredName: z.string().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  
  // Contact Information
  primaryPhone: z.string().optional().nullable(),
  secondaryPhone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional().nullable(),
  pronouns: z.string().optional().nullable(),
  primaryLanguage: z.string().optional().nullable(),
  
  // Communication Preferences & Consent
  preferredChannel: z.enum(['sms', 'email', 'voice']).optional().nullable(),
  smsOptIn: z.boolean().optional().nullable(),
  smsOptInAt: z.coerce.date().optional().nullable(),
  emailOptIn: z.boolean().optional().nullable(),
  voiceOptIn: z.boolean().optional().nullable(),
  doNotContact: z.boolean().optional().nullable(),
  quietHoursStart: z.string().optional().nullable(), // HH:mm format
  quietHoursEnd: z.string().optional().nullable(), // HH:mm format
  consentSource: z.enum(['web', 'voice', 'staff', 'import']).optional().nullable(),
  
  // Insurance Summary
  primaryInsuranceId: z.string().optional().nullable(),
  secondaryInsuranceId: z.string().optional().nullable(),
  insuranceStatus: z.enum(['verified', 'missing', 'expired', 'self_pay']).optional().nullable(),
  lastInsuranceVerifiedAt: z.coerce.date().optional().nullable(),
  selfPay: z.boolean().optional().nullable(),
  
  // Legacy fields
  notes: z.string().optional().nullable(),
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

export const sendgridIntegrationSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  fromEmail: z.string().email('Valid email address is required'),
  fromName: z.string().optional(),
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
  calOrganizationId: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  calTeamId: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
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

