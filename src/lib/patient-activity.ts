/**
 * Patient Activity Logging System
 * 
 * Centralized system for logging all patient-related activities to the timeline.
 * This ensures all actions are automatically captured and displayed in the Activity section.
 */

import { prisma } from './db'

export type ActivityType = 
  | 'appointment'
  | 'insurance'
  | 'call'
  | 'note'
  | 'email'
  | 'field_update'
  | 'document'
  | 'payment'
  | 'reminder'
  | 'task'
  | 'other'

export interface ActivityMetadata {
  [key: string]: any
}

export interface CreateActivityParams {
  patientId: string
  type: ActivityType
  title: string
  description?: string
  metadata?: ActivityMetadata
  userId?: string
}

/**
 * Create a patient activity entry
 * This is the main function to log any activity related to a patient
 */
export async function logPatientActivity(params: CreateActivityParams): Promise<void> {
  try {
    console.log('[logPatientActivity] Creating activity entry:', {
      patientId: params.patientId,
      type: params.type,
      title: params.title,
    })
    const entry = await prisma.patientTimelineEntry.create({
      data: {
        patientId: params.patientId,
        type: params.type,
        title: params.title,
        description: params.description || null,
        metadata: params.metadata || undefined,
      },
    })
    console.log('[logPatientActivity] Successfully created activity entry:', entry.id)
  } catch (error) {
    // Log error but don't throw - activity logging should not break main operations
    console.error('[logPatientActivity] Error logging activity:', error)
    if (error instanceof Error) {
      console.error('[logPatientActivity] Error details:', error.message, error.stack)
    }
  }
}

/**
 * Log email activity when an email is sent to a patient
 */
export async function logEmailActivity(params: {
  patientId: string
  to: string
  subject: string
  messageId?: string
  userId?: string
}): Promise<void> {
  await logPatientActivity({
    patientId: params.patientId,
    type: 'email',
    title: `Email sent to ${params.to}`,
    description: `Subject: ${params.subject}`,
    metadata: {
      to: params.to,
      subject: params.subject,
      messageId: params.messageId,
      userId: params.userId,
    },
  })
}

/**
 * Log notes activity when patient notes are updated
 */
export async function logNotesActivity(params: {
  patientId: string
  oldNotes: string | null
  newNotes: string | null
  userId?: string
}): Promise<void> {
  const wasCreated = !params.oldNotes && params.newNotes
  const wasUpdated = params.oldNotes && params.newNotes && params.oldNotes !== params.newNotes
  const wasDeleted = params.oldNotes && !params.newNotes

  if (wasCreated && params.newNotes) {
    await logPatientActivity({
      patientId: params.patientId,
      type: 'note',
      title: 'Notes added',
      description: params.newNotes.length > 200 
        ? `${params.newNotes.substring(0, 200)}...` 
        : params.newNotes,
      metadata: {
        action: 'created',
        userId: params.userId,
      },
    })
  } else if (wasUpdated && params.newNotes) {
    await logPatientActivity({
      patientId: params.patientId,
      type: 'note',
      title: 'Notes updated',
      description: params.newNotes.length > 200 
        ? `${params.newNotes.substring(0, 200)}...` 
        : params.newNotes,
      metadata: {
        action: 'updated',
        userId: params.userId,
      },
    })
  } else if (wasDeleted) {
    await logPatientActivity({
      patientId: params.patientId,
      type: 'note',
      title: 'Notes deleted',
      metadata: {
        action: 'deleted',
        userId: params.userId,
      },
    })
  }
}

/**
 * Log field update activity when patient fields are changed
 */
export async function logFieldUpdateActivity(params: {
  patientId: string
  field: string
  oldValue: any
  newValue: any
  userId?: string
}): Promise<void> {
  // Skip logging if values are the same
  if (params.oldValue === params.newValue) {
    return
  }

  // Format field name for display
  const fieldDisplayName = formatFieldName(params.field)

  // Format values for display (truncate long values, handle null/undefined)
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'None'
    if (typeof value === 'string' && value.length > 100) {
      return `${value.substring(0, 100)}...`
    }
    return String(value)
  }

  const oldValueStr = formatValue(params.oldValue)
  const newValueStr = formatValue(params.newValue)

  await logPatientActivity({
    patientId: params.patientId,
    type: 'field_update',
    title: `${fieldDisplayName} updated`,
    description: `Changed from "${oldValueStr}" to "${newValueStr}"`,
    metadata: {
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      userId: params.userId,
    },
  })
}

/**
 * Log multiple field updates at once
 */
export async function logFieldUpdatesActivity(params: {
  patientId: string
  changes: Record<string, { oldValue: any; newValue: any }>
  userId?: string
}): Promise<void> {
  const significantChanges = Object.entries(params.changes).filter(
    ([_, change]) => change.oldValue !== change.newValue
  )

  if (significantChanges.length === 0) {
    return
  }

  // Log individual changes for each field
  for (const [field, change] of significantChanges) {
    await logFieldUpdateActivity({
      patientId: params.patientId,
      field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      userId: params.userId,
    })
  }
}

/**
 * Detect and log changes between old and new patient records
 */
export async function logPatientChanges(params: {
  patientId: string
  oldPatient: Record<string, any>
  newPatient: Record<string, any>
  userId?: string
  excludedFields?: string[] // Fields to exclude from logging (e.g., updatedAt, createdAt)
}): Promise<void> {
  const excludedFields = new Set([
    'updatedAt',
    'createdAt',
    'practiceId',
    'id',
    'tags', // Tags are handled separately
    ...(params.excludedFields || []),
  ])

  const changes: Record<string, { oldValue: any; newValue: any }> = {}

  // Check all fields in the new patient object
  for (const field in params.newPatient) {
    if (excludedFields.has(field)) {
      continue
    }

    const oldValue = params.oldPatient[field]
    const newValue = params.newPatient[field]

    // Check if value changed
    if (oldValue !== newValue) {
      changes[field] = { oldValue, newValue }
    }
  }

  // Handle notes separately with more detail
  if (changes.notes) {
    await logNotesActivity({
      patientId: params.patientId,
      oldNotes: changes.notes.oldValue,
      newNotes: changes.notes.newValue,
      userId: params.userId,
    })
    delete changes.notes
  }

  // Log other field changes
  if (Object.keys(changes).length > 0) {
    await logFieldUpdatesActivity({
      patientId: params.patientId,
      changes,
      userId: params.userId,
    })
  }
}

/**
 * Format field names for display (convert snake_case to Title Case)
 */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Log appointment activity (used when appointments are created/updated)
 */
export async function logAppointmentActivity(params: {
  patientId: string
  appointmentId: string
  action: 'created' | 'updated' | 'cancelled' | 'completed'
  title: string
  description?: string
  metadata?: ActivityMetadata
}): Promise<void> {
  await logPatientActivity({
    patientId: params.patientId,
    type: 'appointment',
    title: params.title,
    description: params.description,
    metadata: {
      appointmentId: params.appointmentId,
      action: params.action,
      ...params.metadata,
    },
  })
}

/**
 * Log insurance activity (used when insurance policies are created/updated)
 */
export async function logInsuranceActivity(params: {
  patientId: string
  insuranceId: string
  action: 'created' | 'updated' | 'deleted'
  title: string
  description?: string
  metadata?: ActivityMetadata
}): Promise<void> {
  await logPatientActivity({
    patientId: params.patientId,
    type: 'insurance',
    title: params.title,
    description: params.description,
    metadata: {
      insuranceId: params.insuranceId,
      action: params.action,
      ...params.metadata,
    },
  })
}

/**
 * Log call activity (used when calls are processed)
 */
export async function logCallActivity(params: {
  patientId: string
  callId: string
  title: string
  description?: string
  metadata?: ActivityMetadata
}): Promise<void> {
  await logPatientActivity({
    patientId: params.patientId,
    type: 'call',
    title: params.title,
    description: params.description,
    metadata: {
      callId: params.callId,
      ...params.metadata,
    },
  })
}

/**
 * Generic function to log custom activities
 * Use this for future features that don't fit into existing categories
 */
export async function logCustomActivity(params: {
  patientId: string
  type: ActivityType
  title: string
  description?: string
  metadata?: ActivityMetadata
  userId?: string
}): Promise<void> {
  await logPatientActivity({
    patientId: params.patientId,
    type: params.type,
    title: params.title,
    description: params.description,
    metadata: {
      ...params.metadata,
      userId: params.userId,
    },
  })
}

