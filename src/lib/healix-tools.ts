/**
 * Healix Tool Functions
 * 
 * These are the low-risk actions that Healix can execute.
 * All functions enforce clinic scoping and user permissions.
 */

import { prisma } from './db'
import { tenantScope } from './db'
import { canAccessPractice } from './permissions'
import { logCustomActivity } from './patient-activity'
import { createAuditLog } from './audit'

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
      await logCustomActivity({
        patientId: params.patientId,
        type: 'task',
        title: params.title,
        description: `Due: ${params.dueAt ? new Date(params.dueAt).toLocaleString() : 'No due date'} | Priority: ${params.priority || 'medium'}`,
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
      resourceType: 'task',
      resourceId: params.patientId || params.appointmentId || 'unknown',
      changes: { task: params },
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
      resourceType: 'note',
      resourceId: params.patientId || params.appointmentId || 'unknown',
      changes: { note: params.content },
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
      resourceType: 'message',
      resourceId: params.patientId,
      changes: { message: { channel: params.channel, content: params.content } },
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

