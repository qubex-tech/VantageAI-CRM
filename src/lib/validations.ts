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

export const twilioIntegrationSchema = z.object({
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth token is required'),
  messagingServiceSid: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  fromNumber: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
}).refine((data) => {
  return Boolean(data.messagingServiceSid || data.fromNumber)
}, {
  message: 'Provide either a Messaging Service SID or a From Number',
  path: ['messagingServiceSid'],
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

// Marketing Module schemas
export const brandProfileSchema = z.object({
  practiceName: z.string().min(1, 'Practice name is required'),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a valid hex color').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a valid hex color').optional().nullable(),
  fontFamily: z.enum(['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New']).optional(),
  headerLayout: z.enum(['left', 'center']).optional(),
  emailFooterHtml: z.string().optional().nullable(),
  smsFooterText: z.string().optional().nullable(),
  defaultFromName: z.string().min(1, 'Default from name is required'),
  defaultFromEmail: z.string().email('Default from email must be valid'),
  defaultReplyToEmail: z.string().email('Reply-to email must be valid').optional().nullable(),
  defaultSmsSenderId: z.string().optional().nullable(),
  quietHoursStart: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Quiet hours start must be in HH:mm format').optional(),
  quietHoursEnd: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Quiet hours end must be in HH:mm format').optional(),
  timezone: z.string().optional(),
})

export const marketingTemplateSchema = z.object({
  channel: z.enum(['email', 'sms']),
  name: z.string().min(1, 'Template name is required'),
  category: z.enum(['reminder', 'confirmation', 'reactivation', 'followup', 'reviews', 'broadcast', 'custom']),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  editorType: z.enum(['dragdrop', 'html', 'plaintext']).optional(),
  subject: z.string().optional().nullable(),
  preheader: z.string().optional().nullable(),
  bodyJson: z.any().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  variablesUsed: z.array(z.string()).optional().nullable(),
  complianceConfig: z.any().optional().nullable(),
})

export const previewTemplateSchema = z.object({
  templateId: z.string().uuid(),
  sampleContext: z.object({
    patient: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      preferredName: z.string().optional(),
    }).optional(),
    practice: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    }).optional(),
    appointment: z.object({
      date: z.string().optional(),
      time: z.string().optional(),
      location: z.string().optional(),
      providerName: z.string().optional(),
    }).optional(),
    links: z.object({
      confirm: z.string().url().optional(),
      reschedule: z.string().url().optional(),
      cancel: z.string().url().optional(),
      portalVerified: z.string().url().optional(),
    }).optional(),
  }).optional(),
})

export const testSendEmailSchema = z.object({
  templateId: z.string().uuid(),
  to: z.string().email('Valid email address is required'),
  sampleContext: previewTemplateSchema.shape.sampleContext.optional(),
})

export const testSendSmsSchema = z.object({
  templateId: z.string().uuid(),
  to: z.string().min(10, 'Valid phone number is required'),
  sampleContext: previewTemplateSchema.shape.sampleContext.optional(),
})

// Patient Portal schemas
export const patientOTPRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().min(1, 'Full name is required'),
})

export const patientOTPVerifySchema = z.object({
  code: z.string().length(6),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().min(1, 'Full name is required'),
})

export const consentUpdateSchema = z.object({
  consentType: z.enum(['marketing', 'sms', 'email', 'portal', 'data_sharing']),
  consented: z.boolean(),
})

export const communicationPreferenceSchema = z.object({
  preferredChannel: z.enum(['sms', 'email', 'voice', 'portal']).optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  portalEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  frequencyCap: z.number().int().positive().optional(),
  frequencyPeriod: z.enum(['day', 'week']).optional(),
})

export const messageCreateSchema = z.object({
  threadId: z.string().optional(),
  body: z.string().min(1),
  subject: z.string().optional(),
})

export const appointmentConfirmSchema = z.object({
  appointmentId: z.string(),
})

export const appointmentCancelSchema = z.object({
  appointmentId: z.string(),
  reason: z.string().optional(),
})

export const appointmentRescheduleRequestSchema = z.object({
  appointmentId: z.string(),
  requestedStartTime: z.coerce.date(),
  reason: z.string().optional(),
})

export const feedbackSchema = z.object({
  type: z.enum(['nps', 'csat', 'review']),
  score: z.number().int().min(0).max(10).optional(),
  comment: z.string().optional(),
  reviewRequestId: z.string().optional(),
})

export const referralCreateSchema = z.object({
  referredByPatientId: z.string().optional(),
})

// Task Management schemas
export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
  category: z.enum(['general', 'follow_up', 'document_review', 'billing', 'appointment_prep', 'insurance', 'administrative', 'clinical', 'other']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'on_hold']).default('pending'),
  dueDate: z.coerce.date().optional().nullable(),
  patientId: z.string().uuid().optional().nullable(), // null for personal tasks
  appointmentId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(), // null for unassigned/general tasks
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional().nullable(), // e.g., "daily", "weekly", "monthly"
  metadata: z.record(z.any()).optional().nullable(),
  relatedTaskIds: z.array(z.string().uuid()).optional().default([]),
})

export const taskCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment must be less than 2000 characters'),
})

// Communications schemas
export const communicationMessageSendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1),
  channel: z.enum(['sms', 'email', 'secure', 'voice', 'video']).optional(),
  subject: z.string().optional().nullable(),
  attachments: z.array(
    z.object({
      fileName: z.string().min(1),
      mimeType: z.string().optional().nullable(),
      fileSize: z.number().int().positive().optional().nullable(),
      storageKey: z.string().min(1),
      url: z.string().optional().nullable(),
    })
  ).optional(),
})

export const communicationStartSchema = z.object({
  patientId: z.string().uuid(),
  body: z.string().min(1),
  channel: z.enum(['sms', 'email', 'secure', 'voice', 'video']),
  subject: z.string().optional().nullable(),
})

export const communicationAssignmentSchema = z.object({
  assigneeType: z.enum(['user', 'team']),
  assigneeId: z.string().uuid(),
  status: z.enum(['active', 'pending', 'resolved']).optional(),
})

export const communicationResolveSchema = z.object({
  status: z.enum(['resolved']).default('resolved'),
})

export const communicationNoteSchema = z.object({
  body: z.string().min(1),
})
