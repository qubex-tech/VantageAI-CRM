/**
 * Healix Tool Functions
 * 
 * These are the low-risk actions that Healix can execute.
 * All functions enforce clinic scoping and user permissions.
 */

import { prisma } from './db'
import { tenantScope } from './db'
import { canAccessPractice } from './permissions'
import { logCustomActivity, logEmailActivity, logPatientActivity } from './patient-activity'
import { createAuditLog } from './audit'
import { formatDateTime } from './timezone'
import { getOrCreateVerifiedPatientPortalUrl, getVerifiedFormRequestPortalUrl } from './patient-auth'
import { getSendgridClient } from './sendgrid'
import { getTwilioClient } from './twilio'
import { renderEmailFromJson } from './marketing/render-email'
import { replaceVariables } from './marketing/variables'
import type { VariableContext } from './marketing/types'
import { emitEvent } from './outbox'

export interface HealixToolResult {
  success: boolean
  message: string
  data?: any
}

export interface CreateTaskParams {
  clinicId: string
  patientId?: string
  appointmentId?: string
  title: string
  dueAt?: Date | string
  timeZone?: string
  locale?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface CreateNoteParams {
  clinicId: string
  patientId?: string
  appointmentId?: string
  content: string
}

export interface DraftMessageParams {
  clinicId: string
  patientId: string
  channel: 'sms' | 'email'
  content: string
}

export interface UpdatePatientFieldsParams {
  clinicId: string
  patientId: string
  patch: {
    preferredName?: string
    contactPreferences?: string
    language?: string
    marketingOptIn?: boolean
  }
}

export interface SearchPatientsParams {
  clinicId: string
  query: string
}

export interface ListFormTemplatesParams {
  clinicId: string
}

export interface RequestFormCompletionParams {
  clinicId: string
  patientId: string
  formTemplateId: string
  dueDate?: string
  message?: string
  notifyChannel?: 'email' | 'sms' | 'none'
  notificationTemplateId?: string
}

export interface SendPortalInviteParams {
  clinicId: string
  patientId: string
  channel?: 'email' | 'sms' | 'auto'
}

export interface SendSmsParams {
  clinicId: string
  patientId?: string
  patientName?: string
  message: string
}

export interface GetPatientSummaryParams {
  clinicId: string
  patientId: string
}

export interface GetAppointmentSummaryParams {
  clinicId: string
  appointmentId: string
}

/**
 * Allowed tool names for validation
 */
export const ALLOWED_TOOLS = [
  'createTask',
  'createNote',
  'draftMessage',
  'updatePatientFields',
  'searchPatients',
  'listFormTemplates',
  'requestFormCompletion',
  'sendPortalInvite',
  'sendSms',
  'getPatientSummary',
  'getAppointmentSummary',
] as const

export type AllowedToolName = typeof ALLOWED_TOOLS[number]

/**
 * Validate tool name is in allowlist
 */
export function validateToolName(toolName: string): toolName is AllowedToolName {
  return ALLOWED_TOOLS.includes(toolName as AllowedToolName)
}

/**
 * Validate user can access clinic
 */
async function validateClinicAccess(
  userId: string,
  clinicId: string
): Promise<{ hasAccess: boolean; user: any }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { hasAccess: false, user: null }
  }

  // For vantage_admin, allow access to any clinic
  if (user.role === 'vantage_admin') {
    return { hasAccess: true, user }
  }

  // For others, check if they belong to the clinic
  const hasAccess = canAccessPractice(user, clinicId)
  return { hasAccess, user }
}

/**
 * Create a task (stored as a timeline entry)
 */
export async function createTask(
  params: CreateTaskParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess, user } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to create tasks in this clinic',
      }
    }

    if (!params.patientId && !params.appointmentId) {
      return {
        success: false,
        message: 'Either patientId or appointmentId must be provided',
      }
    }

    // If patientId provided, verify it belongs to the clinic
    if (params.patientId) {
      const patient = await prisma.patient.findFirst({
        where: {
          id: params.patientId,
          practiceId: params.clinicId,
          deletedAt: null,
        },
      })

      if (!patient) {
        return {
          success: false,
          message: 'Patient not found or does not belong to this clinic',
        }
      }

      // Create timeline entry for the task
      const dueLabel = params.dueAt
        ? formatDateTime(params.dueAt, { timeZone: params.timeZone, locale: params.locale })
        : 'No due date'

      await logCustomActivity({
        patientId: params.patientId,
        type: 'task',
        title: params.title,
        description: `Due: ${dueLabel} | Priority: ${params.priority || 'medium'}`,
        metadata: {
          dueAt: params.dueAt,
          priority: params.priority || 'medium',
          appointmentId: params.appointmentId,
          createdBy: 'healix',
          userId,
        },
        userId,
      })
    }

    await createAuditLog({
      practiceId: params.clinicId,
      userId,
      action: 'create',
      resourceType: params.patientId ? 'patient' : params.appointmentId ? 'appointment' : 'patient',
      resourceId: params.patientId || params.appointmentId || 'unknown',
      changes: { after: params },
    })

    return {
      success: true,
      message: `Task "${params.title}" created successfully`,
      data: {
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        title: params.title,
        dueAt: params.dueAt,
        priority: params.priority || 'medium',
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create task',
    }
  }
}

/**
 * Create a note (stored as a timeline entry or patient notes)
 */
export async function createNote(
  params: CreateNoteParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to create notes in this clinic',
      }
    }

    if (!params.patientId && !params.appointmentId) {
      return {
        success: false,
        message: 'Either patientId or appointmentId must be provided',
      }
    }

    // If patientId provided, create timeline entry
    if (params.patientId) {
      const patient = await prisma.patient.findFirst({
        where: {
          id: params.patientId,
          practiceId: params.clinicId,
          deletedAt: null,
        },
      })

      if (!patient) {
        return {
          success: false,
          message: 'Patient not found or does not belong to this clinic',
        }
      }

      await logCustomActivity({
        patientId: params.patientId,
        type: 'note',
        title: 'Note added',
        description: params.content,
        metadata: {
          appointmentId: params.appointmentId,
          createdBy: 'healix',
          userId,
        },
        userId,
      })
    }

    await createAuditLog({
      practiceId: params.clinicId,
      userId,
      action: 'create',
      resourceType: params.patientId ? 'patient' : params.appointmentId ? 'appointment' : 'patient',
      resourceId: params.patientId || params.appointmentId || 'unknown',
      changes: { after: { content: params.content } },
    })

    return {
      success: true,
      message: 'Note created successfully',
      data: {
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        content: params.content,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create note',
    }
  }
}

/**
 * Draft a message (doesn't send, just prepares it)
 */
export async function draftMessage(
  params: DraftMessageParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to draft messages in this clinic',
      }
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    // Verify channel is appropriate
    if (params.channel === 'email' && !patient.email) {
      return {
        success: false,
        message: 'Patient does not have an email address on file',
      }
    }

    if (params.channel === 'sms' && !patient.phone) {
      return {
        success: false,
        message: 'Patient does not have a phone number on file',
      }
    }

    // Create timeline entry for drafted message
    await logCustomActivity({
      patientId: params.patientId,
      type: 'email',
      title: `Drafted ${params.channel.toUpperCase()} message`,
      description: params.content.substring(0, 200) + (params.content.length > 200 ? '...' : ''),
      metadata: {
        channel: params.channel,
        content: params.content,
        status: 'drafted',
        createdBy: 'healix',
        userId,
      },
      userId,
    })

      await createAuditLog({
        practiceId: params.clinicId,
        userId,
        action: 'create',
        resourceType: 'patient',
        resourceId: params.patientId,
        changes: { after: { channel: params.channel, content: params.content } },
      })

    return {
      success: true,
      message: `Message drafted successfully (${params.channel})`,
      data: {
        patientId: params.patientId,
        channel: params.channel,
        to: params.channel === 'email' ? patient.email : patient.phone,
        content: params.content,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to draft message',
    }
  }
}

/**
 * Update patient fields (only non-sensitive fields allowed)
 */
export async function updatePatientFields(
  params: UpdatePatientFieldsParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to update patients in this clinic',
      }
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    // Only allow non-sensitive fields
    const allowedFields = ['preferredName', 'contactPreferences', 'language', 'marketingOptIn']
    const updateData: any = {}

    // Map fields to database columns
    if (params.patch.preferredName !== undefined) {
      // Note: Patient model doesn't have preferredName field, so we'll store in notes or skip
      // For now, we'll log it but not update (as schema doesn't support it)
      // You may want to add this field to Patient model in the future
    }

    if (params.patch.contactPreferences !== undefined) {
      updateData.preferredContactMethod = params.patch.contactPreferences
    }

    // Note: Patient model doesn't have language or marketingOptIn fields
    // These would need to be added to the schema or stored in metadata
    // For now, we'll log the attempt

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        message: 'No valid fields to update. Schema may need additional fields.',
      }
    }

    const oldPatient = { ...patient }
    const updatedPatient = await prisma.patient.update({
      where: { id: params.patientId },
      data: updateData,
    })

    await createAuditLog({
      practiceId: params.clinicId,
      userId,
      action: 'update',
      resourceType: 'patient',
      resourceId: params.patientId,
      changes: { before: oldPatient, after: updatedPatient },
    })

    return {
      success: true,
      message: 'Patient fields updated successfully',
      data: {
        patientId: params.patientId,
        updatedFields: Object.keys(updateData),
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update patient fields',
    }
  }
}

/**
 * Search patients
 */
export async function searchPatients(
  params: SearchPatientsParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to search patients in this clinic',
      }
    }

    const patients = await prisma.patient.findMany({
      where: {
        practiceId: params.clinicId,
        deletedAt: null,
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { phone: { contains: params.query } },
          { email: { contains: params.query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        preferredContactMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      message: `Found ${patients.length} patient(s)`,
      data: {
        patients,
        count: patients.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to search patients',
    }
  }
}

/**
 * List form templates for the practice
 */
export async function listFormTemplates(
  params: ListFormTemplatesParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to view form templates in this clinic',
      }
    }

    const templates = await prisma.formTemplate.findMany({
      where: {
        practiceId: params.clinicId,
        status: 'published',
      },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        isSystem: true,
        updatedAt: true,
      },
    })

    return {
      success: true,
      message: `Found ${templates.length} form template(s)`,
      data: { templates },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list form templates',
    }
  }
}

/**
 * Request patient form completion and optionally notify
 */
export async function requestFormCompletion(
  params: RequestFormCompletionParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess, user } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess || !user) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to request forms in this clinic',
      }
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        phone: true,
        primaryPhone: true,
        secondaryPhone: true,
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    const template = await prisma.formTemplate.findFirst({
      where: {
        id: params.formTemplateId,
        practiceId: params.clinicId,
        status: 'published',
      },
    })

    if (!template) {
      return {
        success: false,
        message: 'Form template not found or not published',
      }
    }

    const request = await prisma.formRequest.create({
      data: {
        practiceId: params.clinicId,
        patientId: params.patientId,
        formTemplateId: params.formTemplateId,
        dueDate: params.dueDate ? new Date(params.dueDate) : null,
        metadata: params.message ? { message: params.message } : undefined,
        createdByUserId: userId,
      },
    })

    await prisma.patientTask.create({
      data: {
        practiceId: params.clinicId,
        patientId: params.patientId,
        type: 'form_completion',
        title: `Complete ${template.name}`,
        description: params.message || 'Please complete this form at your earliest convenience.',
        status: 'pending',
        dueDate: params.dueDate ? new Date(params.dueDate) : null,
        metadata: {
          formRequestId: request.id,
          formTemplateId: request.formTemplateId,
        },
      },
    })

    const portalLink = await getVerifiedFormRequestPortalUrl({
      practiceId: params.clinicId,
      patientId: params.patientId,
      formRequestId: request.id,
    })

    const notifyChannel = params.notifyChannel || 'none'
    let notificationStatus: { status: 'sent' | 'failed' | 'skipped'; error?: string } = { status: 'skipped' }

    if (notifyChannel !== 'none') {
      if (!params.notificationTemplateId) {
        return {
          success: false,
          message: 'Notification template is required to send a form request message.',
        }
      }

      const brandProfile = await prisma.brandProfile.findUnique({
        where: { tenantId: params.clinicId },
      })

      let portalVerifiedUrl = '#'
      try {
        const portalVerified = await getOrCreateVerifiedPatientPortalUrl({
          practiceId: params.clinicId,
          patientId: params.patientId,
        })
        portalVerifiedUrl = portalVerified.url
      } catch {
        // Best-effort fallback
      }

      const context: VariableContext = {
        patient: {
          firstName: patient.firstName || patient.name?.split(' ')[0] || '',
          lastName: patient.lastName || patient.name?.split(' ').slice(1).join(' ') || '',
          preferredName: patient.preferredName || patient.firstName || patient.name?.split(' ')[0] || '',
        },
        practice: {
          name: brandProfile?.practiceName || '',
          phone: brandProfile?.defaultFromEmail || '',
          address: '',
        },
        links: {
          portalVerified: portalVerifiedUrl,
          formRequest: portalLink.url,
        },
      }

      const notificationTemplate = await prisma.marketingTemplate.findFirst({
        where: {
          id: params.notificationTemplateId,
          tenantId: params.clinicId,
          channel: notifyChannel,
        },
      })

      if (!notificationTemplate) {
        return {
          success: false,
          message: 'Notification template not found for the selected channel.',
        }
      }

      try {
        if (notifyChannel === 'email') {
          if (!patient.email) {
            throw new Error('Patient has no email address on file')
          }

          const sendgridClient = await getSendgridClient(params.clinicId)
          const sendgridIntegration = await prisma.sendgridIntegration.findFirst({
            where: {
              practiceId: params.clinicId,
              isActive: true,
            },
          })

          if (!sendgridIntegration) {
            throw new Error('SendGrid integration is not configured')
          }

          let html = notificationTemplate.bodyHtml || ''
          let text = notificationTemplate.bodyText || ''

          if (notificationTemplate.editorType === 'dragdrop' && notificationTemplate.bodyJson) {
            let bodyJson: any = notificationTemplate.bodyJson
            if (typeof bodyJson === 'string') {
              try {
                bodyJson = JSON.parse(bodyJson)
              } catch {
                bodyJson = null
              }
            }

            if (bodyJson && bodyJson.rows) {
              const rendered = renderEmailFromJson(bodyJson, brandProfile, context)
              html = rendered.html
              text = rendered.text
            }
          } else if (notificationTemplate.editorType === 'html' && notificationTemplate.bodyHtml) {
            html = notificationTemplate.bodyHtml
            text = notificationTemplate.bodyHtml.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
          }

          if (!html && !text) {
            throw new Error('Email template has no content')
          }

          const subject = notificationTemplate.subject
            ? replaceVariables(notificationTemplate.subject, context)
            : 'Please complete your form'

          const htmlWithVars = replaceVariables(html || '', context)
          const textWithVars = replaceVariables(text || '', context)

          const result = await sendgridClient.sendEmail({
            to: patient.email,
            toName: patient.name || undefined,
            subject,
            htmlContent: htmlWithVars || undefined,
            textContent: textWithVars || undefined,
            fromName: sendgridIntegration.fromName || brandProfile?.defaultFromName || undefined,
            replyTo: brandProfile?.defaultReplyToEmail || undefined,
          })

          if (!result.success) {
            throw new Error(result.error || 'Failed to send email')
          }

          await logEmailActivity({
            patientId: patient.id,
            to: patient.email,
            subject,
            messageId: result.messageId,
            userId,
          })

          notificationStatus = { status: 'sent' }
        }

        if (notifyChannel === 'sms') {
          const phoneNumber = patient.primaryPhone || patient.phone
          if (!phoneNumber) {
            throw new Error('Patient has no phone number on file')
          }

          if (!notificationTemplate.bodyText) {
            throw new Error('SMS template has no message body')
          }

          const messageBody = replaceVariables(notificationTemplate.bodyText, context)
          const twilioClient = await getTwilioClient(params.clinicId)
          const result = await twilioClient.sendSms({
            to: phoneNumber,
            body: messageBody,
          })

          if (!result.success) {
            throw new Error(result.error || 'Failed to send SMS')
          }

          await logPatientActivity({
            patientId: patient.id,
            type: 'call',
            title: `Form request sent via SMS`,
            description: messageBody.slice(0, 160),
            metadata: {
              to: phoneNumber,
              messageId: result.messageId,
              userId,
              formRequestId: request.id,
            },
          })

          notificationStatus = { status: 'sent' }
        }
      } catch (notificationError) {
        notificationStatus = {
          status: 'failed',
          error: notificationError instanceof Error ? notificationError.message : 'Failed to send notification',
        }
      }
    }

    await emitEvent({
      practiceId: params.clinicId,
      eventName: 'crm/form_request.created',
      entityType: 'form_request',
      entityId: request.id,
      data: {
        patientId: patient.id,
        formRequest: {
          id: request.id,
          status: request.status,
          dueDate: request.dueDate,
          templateId: request.formTemplateId,
        },
        links: {
          formRequest: portalLink.url,
        },
      },
    })

    await createAuditLog({
      practiceId: params.clinicId,
      userId,
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: { after: { formRequestId: request.id, formTemplateId: request.formTemplateId } },
    })

    return {
      success: true,
      message: 'Form request created successfully',
      data: {
        requestId: request.id,
        status: request.status,
        formRequestUrl: portalLink.url,
        notification: notificationStatus,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to request form completion',
    }
  }
}

/**
 * Send a patient portal invite
 */
export async function sendPortalInvite(
  params: SendPortalInviteParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to send portal invites in this clinic',
      }
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        primaryPhone: true,
        secondaryPhone: true,
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    const urlResult = await getOrCreateVerifiedPatientPortalUrl({
      practiceId: params.clinicId,
      patientId: patient.id,
    })

    const email = patient.email?.trim() || null
    const phone = (patient.primaryPhone || patient.phone || patient.secondaryPhone || '').trim()
    const hasPhone = Boolean(phone.replace(/[^\d]/g, ''))

    const channel = params.channel || 'auto'
    const chosenChannel =
      channel === 'auto'
        ? email
          ? 'email'
          : hasPhone
            ? 'sms'
            : null
        : channel

    if (!chosenChannel) {
      return {
        success: false,
        message: 'Patient does not have an email or phone number on file.',
      }
    }

    if (chosenChannel === 'email') {
      if (!email) {
        return { success: false, message: 'Patient email is missing.' }
      }

      const sendgridClient = await getSendgridClient(params.clinicId)
      const subject = 'Your secure link to the Patient Portal'
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <p>Hello ${patient.name || 'there'},</p>
          <p>Use the secure link below to access your Patient Portal:</p>
          <p style="margin: 16px 0;">
            <a href="${urlResult.url}" style="display:inline-block; padding: 10px 14px; background:#111827; color:#ffffff; border-radius:8px; text-decoration:none;">
              Open Patient Portal
            </a>
          </p>
          <p style="font-size: 12px; color: #6b7280;">
            This link expires on ${urlResult.expiresAt.toLocaleDateString()}.
          </p>
          <p style="font-size: 12px; color: #6b7280;">
            If you did not expect this message, you can ignore it.
          </p>
          <hr style="border:none; border-top:1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 12px; color: #6b7280;">Secure link: ${urlResult.url}</p>
        </div>
      `.trim()
      const textContent = `
Hello ${patient.name || 'there'},

Use the secure link below to access your Patient Portal:
${urlResult.url}

This link expires on ${urlResult.expiresAt.toLocaleDateString()}.
If you did not expect this message, you can ignore it.
      `.trim()

      const result = await sendgridClient.sendEmail({
        to: email,
        toName: patient.name || undefined,
        subject,
        htmlContent,
        textContent,
      })

      if (!result.success) {
        return { success: false, message: result.error || 'Failed to send email' }
      }

      await logEmailActivity({
        patientId: patient.id,
        to: email,
        subject,
        messageId: result.messageId,
        userId,
      })

      return {
        success: true,
        message: `Portal invite sent via email to ${email}`,
        data: { channel: 'email', sentTo: email, url: urlResult.url },
      }
    }

    if (!hasPhone) {
      return { success: false, message: 'Patient phone number is missing.' }
    }

    const twilioClient = await getTwilioClient(params.clinicId)
    const message = `Secure Patient Portal link:\n${urlResult.url}\nExpires ${urlResult.expiresAt.toLocaleDateString()}.`
    const result = await twilioClient.sendSms({
      to: phone,
      body: message,
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to send SMS' }
    }

    await logPatientActivity({
      patientId: patient.id,
      type: 'call',
      title: `Portal invite sent via SMS`,
      description: `Sent to ${phone}`,
      metadata: {
        to: phone,
        messageId: result.messageId,
        userId,
        inviteExpiresAt: urlResult.expiresAt,
      },
    })

    return {
      success: true,
      message: `Portal invite sent via SMS to ${phone}`,
      data: { channel: 'sms', sentTo: phone, url: urlResult.url },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send portal invite',
    }
  }
}

/**
 * Send an SMS to a patient
 */
export async function sendSms(
  params: SendSmsParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to send SMS in this clinic',
      }
    }

    let patientId = params.patientId
    if (!patientId) {
      const query = params.patientName?.trim()
      if (!query) {
        return {
          success: false,
          message: 'patientId or patientName is required to send an SMS',
        }
      }

      const matches = await prisma.patient.findMany({
        where: {
          practiceId: params.clinicId,
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          primaryPhone: true,
          dateOfBirth: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      })

      if (matches.length === 0) {
        return {
          success: false,
          message: `No patient found matching "${query}"`,
        }
      }

      if (matches.length > 1) {
        return {
          success: false,
          message: `Multiple patients match "${query}". Please specify the patient.`,
          data: { candidates: matches },
        }
      }

      patientId = matches[0].id
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        primaryPhone: true,
        secondaryPhone: true,
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    const phone = (patient.primaryPhone || patient.phone || patient.secondaryPhone || '').trim()
    if (!phone) {
      return {
        success: false,
        message: 'Patient has no phone number on file',
      }
    }

    const twilioClient = await getTwilioClient(params.clinicId)
    const result = await twilioClient.sendSms({
      to: phone,
      body: params.message,
    })

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to send SMS' }
    }

    await logPatientActivity({
      patientId: patient.id,
      type: 'call',
      title: `SMS sent to ${phone}`,
      description: params.message.length > 160 ? `${params.message.slice(0, 160)}...` : params.message,
      metadata: {
        to: phone,
        messageId: result.messageId,
        userId,
      },
    })

    await createAuditLog({
      practiceId: params.clinicId,
      userId,
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: { after: { message: params.message } },
    })

    return {
      success: true,
      message: `SMS sent to ${patient.name || phone}`,
      data: { messageId: result.messageId },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send SMS',
    }
  }
}

/**
 * Get patient summary
 */
export async function getPatientSummary(
  params: GetPatientSummaryParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to view this patient',
      }
    }

    const patient = await prisma.patient.findFirst({
      where: {
        id: params.patientId,
        practiceId: params.clinicId,
        deletedAt: null,
      },
      include: {
        appointments: {
          take: 5,
          orderBy: { startTime: 'desc' },
          select: {
            id: true,
            status: true,
            startTime: true,
            visitType: true,
          },
        },
        insurancePolicies: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            providerName: true,
            eligibilityStatus: true,
          },
        },
        timelineEntries: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            appointments: true,
            insurancePolicies: true,
            timelineEntries: true,
          },
        },
      },
    })

    if (!patient) {
      return {
        success: false,
        message: 'Patient not found or does not belong to this clinic',
      }
    }

    // Redact sensitive data for summary
    const summary = {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      preferredContactMethod: patient.preferredContactMethod,
      recentAppointments: patient.appointments,
      insurancePolicies: patient.insurancePolicies,
      recentTimelineEntries: patient.timelineEntries,
      counts: patient._count,
      createdAt: patient.createdAt,
    }

    return {
      success: true,
      message: 'Patient summary retrieved successfully',
      data: summary,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get patient summary',
    }
  }
}

/**
 * Get appointment summary
 */
export async function getAppointmentSummary(
  params: GetAppointmentSummaryParams,
  userId: string
): Promise<HealixToolResult> {
  try {
    const { hasAccess } = await validateClinicAccess(userId, params.clinicId)
    if (!hasAccess) {
      return {
        success: false,
        message: 'Access denied: You do not have permission to view this appointment',
      }
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.appointmentId,
        practiceId: params.clinicId,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!appointment) {
      return {
        success: false,
        message: 'Appointment not found or does not belong to this clinic',
      }
    }

    const summary = {
      id: appointment.id,
      status: appointment.status,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      timezone: appointment.timezone,
      visitType: appointment.visitType,
      reason: appointment.reason,
      notes: appointment.notes,
      patient: appointment.patient,
      calBookingId: appointment.calBookingId,
    }

    return {
      success: true,
      message: 'Appointment summary retrieved successfully',
      data: summary,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get appointment summary',
    }
  }
}

/**
 * Execute a tool by name with validation
 */
export async function executeTool(
  toolName: string,
  args: any,
  userId: string
): Promise<HealixToolResult> {
  // Validate tool name
  if (!validateToolName(toolName)) {
    return {
      success: false,
      message: `Tool "${toolName}" is not allowed. Allowed tools: ${ALLOWED_TOOLS.join(', ')}`,
    }
  }

  // Validate args have clinicId
  if (!args.clinicId) {
    return {
      success: false,
      message: 'clinicId is required for all tool calls',
    }
  }

  // Execute tool
  switch (toolName) {
    case 'createTask':
      return createTask(args as CreateTaskParams, userId)
    case 'createNote':
      return createNote(args as CreateNoteParams, userId)
    case 'draftMessage':
      return draftMessage(args as DraftMessageParams, userId)
    case 'updatePatientFields':
      return updatePatientFields(args as UpdatePatientFieldsParams, userId)
    case 'searchPatients':
      return searchPatients(args as SearchPatientsParams, userId)
    case 'listFormTemplates':
      return listFormTemplates(args as ListFormTemplatesParams, userId)
    case 'requestFormCompletion':
      return requestFormCompletion(args as RequestFormCompletionParams, userId)
    case 'sendPortalInvite':
      return sendPortalInvite(args as SendPortalInviteParams, userId)
    case 'sendSms':
      return sendSms(args as SendSmsParams, userId)
    case 'getPatientSummary':
      return getPatientSummary(args as GetPatientSummaryParams, userId)
    case 'getAppointmentSummary':
      return getAppointmentSummary(args as GetAppointmentSummaryParams, userId)
    default:
      return {
        success: false,
        message: `Tool "${toolName}" not implemented`,
      }
  }
}

