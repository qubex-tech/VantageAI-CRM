import { describe, it, expect } from 'vitest'
import {
  patientSchema,
  appointmentSchema,
  loginSchema,
  insurancePolicyFormSchema,
  insurancePolicyFormSchemaPartial,
  calIntegrationSchema,
  calEventTypeMappingSchema,
  bookAppointmentSchema,
  sendgridIntegrationSchema,
  twilioIntegrationSchema,
  telnyxIntegrationSchema,
  brandProfileSchema,
  marketingTemplateSchema,
  patientOTPRequestSchema,
  patientOTPVerifySchema,
  consentUpdateSchema,
  communicationPreferenceSchema,
  taskSchema,
  taskCommentSchema,
  communicationMessageSendSchema,
  communicationStartSchema,
} from '@/lib/validations'

describe('Validation Schemas', () => {
  describe('patientSchema', () => {
    it('should accept valid patient data with all fields', () => {
      const validPatient = {
        name: 'John Doe',
        phone: '+15551234567',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfBirth: new Date('1990-01-15'),
        preferredContactMethod: 'phone',
        gender: 'male',
        smsOptIn: true,
      }

      const result = patientSchema.safeParse(validPatient)
      expect(result.success).toBe(true)
    })

    it('should accept patient with minimal data', () => {
      const minimalPatient = {}
      const result = patientSchema.safeParse(minimalPatient)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidPatient = {
        email: 'not-an-email',
      }
      const result = patientSchema.safeParse(invalidPatient)
      expect(result.success).toBe(false)
    })

    it('should accept empty string email', () => {
      const patientWithEmptyEmail = {
        email: '',
      }
      const result = patientSchema.safeParse(patientWithEmptyEmail)
      expect(result.success).toBe(true)
    })

    it('should accept null email', () => {
      const patientWithNullEmail = {
        email: null,
      }
      const result = patientSchema.safeParse(patientWithNullEmail)
      expect(result.success).toBe(true)
    })

    it('should validate preferredContactMethod enum', () => {
      const validMethods = ['phone', 'email', 'sms', 'mail']
      validMethods.forEach(method => {
        const result = patientSchema.safeParse({ preferredContactMethod: method })
        expect(result.success).toBe(true)
      })

      const result = patientSchema.safeParse({ preferredContactMethod: 'carrier_pigeon' })
      expect(result.success).toBe(false)
    })

    it('should validate gender enum', () => {
      const validGenders = ['male', 'female', 'other', 'unknown']
      validGenders.forEach(gender => {
        const result = patientSchema.safeParse({ gender })
        expect(result.success).toBe(true)
      })
    })

    it('should validate insuranceStatus enum', () => {
      const validStatuses = ['verified', 'missing', 'expired', 'self_pay']
      validStatuses.forEach(status => {
        const result = patientSchema.safeParse({ insuranceStatus: status })
        expect(result.success).toBe(true)
      })
    })

    it('should accept tags array', () => {
      const result = patientSchema.safeParse({
        tags: ['vip', 'diabetic', 'new-patient'],
      })
      expect(result.success).toBe(true)
    })

    it('should coerce date strings to Date objects', () => {
      const result = patientSchema.safeParse({
        dateOfBirth: '1990-01-15',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dateOfBirth).toBeInstanceOf(Date)
      }
    })
  })

  describe('appointmentSchema', () => {
    it('should accept valid appointment data', () => {
      const validAppointment = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        timezone: 'America/New_York',
        visitType: 'Consultation',
        status: 'scheduled',
      }

      const result = appointmentSchema.safeParse(validAppointment)
      expect(result.success).toBe(true)
    })

    it('should require patientId to be a valid UUID', () => {
      const result = appointmentSchema.safeParse({
        patientId: 'not-a-uuid',
        startTime: new Date(),
        endTime: new Date(),
        timezone: 'America/New_York',
        visitType: 'Consultation',
      })
      expect(result.success).toBe(false)
    })

    it('should require visitType', () => {
      const result = appointmentSchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        startTime: new Date(),
        endTime: new Date(),
        timezone: 'America/New_York',
        visitType: '',
      })
      expect(result.success).toBe(false)
    })

    it('should validate status enum', () => {
      const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']
      validStatuses.forEach(status => {
        const result = appointmentSchema.safeParse({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          startTime: new Date(),
          endTime: new Date(),
          timezone: 'America/New_York',
          visitType: 'Consultation',
          status,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should default status to scheduled', () => {
      const result = appointmentSchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        startTime: new Date(),
        endTime: new Date(),
        timezone: 'America/New_York',
        visitType: 'Consultation',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('scheduled')
      }
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login credentials', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'securepassword',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email address')
      }
    })

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password is required')
      }
    })
  })

  describe('insurancePolicyFormSchema', () => {
    it('should accept valid insurance policy when subscriber is patient', () => {
      const result = insurancePolicyFormSchema.safeParse({
        payerNameRaw: 'Blue Cross Blue Shield',
        memberId: 'ABC123456',
        isPrimary: true,
        subscriberIsPatient: true,
      })
      expect(result.success).toBe(true)
    })

    it('should require subscriber info when subscriber is not patient', () => {
      const result = insurancePolicyFormSchema.safeParse({
        payerNameRaw: 'Blue Cross Blue Shield',
        memberId: 'ABC123456',
        isPrimary: false,
        subscriberIsPatient: false,
      })
      expect(result.success).toBe(false)
    })

    it('should accept complete subscriber info when not patient', () => {
      const result = insurancePolicyFormSchema.safeParse({
        payerNameRaw: 'Blue Cross Blue Shield',
        memberId: 'ABC123456',
        isPrimary: false,
        subscriberIsPatient: false,
        subscriberFirstName: 'Jane',
        subscriberLastName: 'Doe',
        subscriberDob: new Date('1985-05-20'),
        relationshipToPatient: 'Spouse',
      })
      expect(result.success).toBe(true)
    })

    it('should require payerNameRaw', () => {
      const result = insurancePolicyFormSchema.safeParse({
        memberId: 'ABC123456',
        isPrimary: true,
        subscriberIsPatient: true,
      })
      expect(result.success).toBe(false)
    })

    it('should require memberId', () => {
      const result = insurancePolicyFormSchema.safeParse({
        payerNameRaw: 'Blue Cross Blue Shield',
        isPrimary: true,
        subscriberIsPatient: true,
      })
      expect(result.success).toBe(false)
    })

    it('should validate planType enum', () => {
      const validTypes = ['PPO', 'HMO', 'EPO', 'POS', 'Medicare', 'Medicaid', 'Other', 'Unknown']
      validTypes.forEach(planType => {
        const result = insurancePolicyFormSchema.safeParse({
          payerNameRaw: 'Test Payer',
          memberId: '123',
          isPrimary: true,
          subscriberIsPatient: true,
          planType,
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('calIntegrationSchema', () => {
    it('should accept valid Cal.com integration data', () => {
      const result = calIntegrationSchema.safeParse({
        apiKey: 'cal_live_abc123',
        calOrganizationId: 'org-123',
        calTeamId: 'team-456',
      })
      expect(result.success).toBe(true)
    })

    it('should require apiKey', () => {
      const result = calIntegrationSchema.safeParse({
        calOrganizationId: 'org-123',
      })
      expect(result.success).toBe(false)
    })

    it('should transform empty strings to undefined for optional fields', () => {
      const result = calIntegrationSchema.safeParse({
        apiKey: 'cal_live_abc123',
        calOrganizationId: '',
        calTeamId: '',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.calOrganizationId).toBeUndefined()
        expect(result.data.calTeamId).toBeUndefined()
      }
    })
  })

  describe('bookAppointmentSchema', () => {
    it('should accept valid booking data', () => {
      const result = bookAppointmentSchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        eventTypeId: 'evt-123',
        startTime: '2024-01-15T10:00:00Z',
        timezone: 'America/New_York',
      })
      expect(result.success).toBe(true)
    })

    it('should require eventTypeId', () => {
      const result = bookAppointmentSchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        startTime: '2024-01-15T10:00:00Z',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('twilioIntegrationSchema', () => {
    it('should accept valid Twilio data with messaging service', () => {
      const result = twilioIntegrationSchema.safeParse({
        accountSid: 'AC123',
        authToken: 'token123',
        messagingServiceSid: 'MG123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid Twilio data with from number', () => {
      const result = twilioIntegrationSchema.safeParse({
        accountSid: 'AC123',
        authToken: 'token123',
        fromNumber: '+15551234567',
      })
      expect(result.success).toBe(true)
    })

    it('should require either messagingServiceSid or fromNumber', () => {
      const result = twilioIntegrationSchema.safeParse({
        accountSid: 'AC123',
        authToken: 'token123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('brandProfileSchema', () => {
    it('should accept valid brand profile', () => {
      const result = brandProfileSchema.safeParse({
        practiceName: 'Test Dental Practice',
        primaryColor: '#2563eb',
        defaultFromName: 'Test Practice',
        defaultFromEmail: 'noreply@testpractice.com',
      })
      expect(result.success).toBe(true)
    })

    it('should validate hex color format', () => {
      const result = brandProfileSchema.safeParse({
        practiceName: 'Test',
        primaryColor: 'not-a-hex-color',
        defaultFromName: 'Test',
        defaultFromEmail: 'test@test.com',
      })
      expect(result.success).toBe(false)
    })

    it('should validate quiet hours format', () => {
      const validResult = brandProfileSchema.safeParse({
        practiceName: 'Test',
        defaultFromName: 'Test',
        defaultFromEmail: 'test@test.com',
        quietHoursStart: '09:00',
        quietHoursEnd: '17:00',
      })
      expect(validResult.success).toBe(true)

      const invalidResult = brandProfileSchema.safeParse({
        practiceName: 'Test',
        defaultFromName: 'Test',
        defaultFromEmail: 'test@test.com',
        quietHoursStart: '9am',
      })
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('marketingTemplateSchema', () => {
    it('should accept valid email template', () => {
      const result = marketingTemplateSchema.safeParse({
        channel: 'email',
        name: 'Appointment Reminder',
        category: 'reminder',
        subject: 'Your upcoming appointment',
        bodyHtml: '<p>Hello {{patient.firstName}}</p>',
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid SMS template', () => {
      const result = marketingTemplateSchema.safeParse({
        channel: 'sms',
        name: 'Quick Reminder',
        category: 'reminder',
        bodyText: 'Hi {{patient.firstName}}, reminder of your apt tomorrow',
      })
      expect(result.success).toBe(true)
    })

    it('should validate channel enum', () => {
      const result = marketingTemplateSchema.safeParse({
        channel: 'telegram',
        name: 'Test',
        category: 'reminder',
      })
      expect(result.success).toBe(false)
    })

    it('should validate category enum', () => {
      const validCategories = ['reminder', 'confirmation', 'reactivation', 'followup', 'reviews', 'broadcast', 'custom']
      validCategories.forEach(category => {
        const result = marketingTemplateSchema.safeParse({
          channel: 'email',
          name: 'Test',
          category,
        })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('patientOTPRequestSchema', () => {
    it('should accept request with email', () => {
      const result = patientOTPRequestSchema.safeParse({
        email: 'patient@example.com',
        fullName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with phone', () => {
      const result = patientOTPRequestSchema.safeParse({
        phone: '+15551234567',
        fullName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('should require fullName', () => {
      const result = patientOTPRequestSchema.safeParse({
        email: 'patient@example.com',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('patientOTPVerifySchema', () => {
    it('should accept valid OTP verification', () => {
      const result = patientOTPVerifySchema.safeParse({
        code: '123456',
        email: 'patient@example.com',
        fullName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('should require exactly 6-digit code', () => {
      const shortResult = patientOTPVerifySchema.safeParse({
        code: '12345',
        fullName: 'John Doe',
      })
      expect(shortResult.success).toBe(false)

      const longResult = patientOTPVerifySchema.safeParse({
        code: '1234567',
        fullName: 'John Doe',
      })
      expect(longResult.success).toBe(false)
    })
  })

  describe('taskSchema', () => {
    it('should accept valid task', () => {
      const result = taskSchema.safeParse({
        title: 'Follow up with patient',
        description: 'Call to check on recovery',
        category: 'follow_up',
        priority: 'high',
        dueDate: new Date(),
      })
      expect(result.success).toBe(true)
    })

    it('should require title', () => {
      const result = taskSchema.safeParse({
        description: 'No title here',
      })
      expect(result.success).toBe(false)
    })

    it('should validate title max length', () => {
      const result = taskSchema.safeParse({
        title: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
    })

    it('should validate category enum', () => {
      const validCategories = ['general', 'follow_up', 'document_review', 'billing', 'appointment_prep', 'insurance', 'administrative', 'clinical', 'other']
      validCategories.forEach(category => {
        const result = taskSchema.safeParse({
          title: 'Test task',
          category,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should validate priority enum', () => {
      const validPriorities = ['low', 'medium', 'high', 'urgent']
      validPriorities.forEach(priority => {
        const result = taskSchema.safeParse({
          title: 'Test task',
          priority,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should default values correctly', () => {
      const result = taskSchema.safeParse({
        title: 'Test task',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.category).toBe('general')
        expect(result.data.priority).toBe('medium')
        expect(result.data.status).toBe('pending')
        expect(result.data.isRecurring).toBe(false)
      }
    })
  })

  describe('taskCommentSchema', () => {
    it('should accept valid comment', () => {
      const result = taskCommentSchema.safeParse({
        content: 'This is a comment on the task',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty content', () => {
      const result = taskCommentSchema.safeParse({
        content: '',
      })
      expect(result.success).toBe(false)
    })

    it('should validate max length', () => {
      const result = taskCommentSchema.safeParse({
        content: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('communicationMessageSendSchema', () => {
    it('should accept valid message', () => {
      const result = communicationMessageSendSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        body: 'Hello, how can I help you?',
        channel: 'sms',
      })
      expect(result.success).toBe(true)
    })

    it('should require body', () => {
      const result = communicationMessageSendSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        body: '',
      })
      expect(result.success).toBe(false)
    })

    it('should accept attachments', () => {
      const result = communicationMessageSendSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        body: 'See attached',
        attachments: [
          {
            fileName: 'document.pdf',
            storageKey: 'files/doc-123.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
          },
        ],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('consentUpdateSchema', () => {
    it('should accept valid consent update', () => {
      const validTypes = ['marketing', 'sms', 'email', 'portal', 'data_sharing']
      validTypes.forEach(consentType => {
        const result = consentUpdateSchema.safeParse({
          consentType,
          consented: true,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should require consented boolean', () => {
      const result = consentUpdateSchema.safeParse({
        consentType: 'marketing',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('communicationPreferenceSchema', () => {
    it('should accept valid preferences', () => {
      const result = communicationPreferenceSchema.safeParse({
        preferredChannel: 'email',
        smsEnabled: true,
        emailEnabled: true,
        voiceEnabled: false,
        portalEnabled: true,
        earlierAppointmentOptIn: true,
        quietHoursStart: '21:00',
        quietHoursEnd: '08:00',
      })
      expect(result.success).toBe(true)
    })

    it('should validate preferredChannel enum', () => {
      const validChannels = ['sms', 'email', 'voice', 'portal']
      validChannels.forEach(channel => {
        const result = communicationPreferenceSchema.safeParse({
          preferredChannel: channel,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should validate frequencyPeriod enum', () => {
      const validPeriods = ['day', 'week']
      validPeriods.forEach(period => {
        const result = communicationPreferenceSchema.safeParse({
          frequencyPeriod: period,
          frequencyCap: 5,
        })
        expect(result.success).toBe(true)
      })
    })
  })
})
