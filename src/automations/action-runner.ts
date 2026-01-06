import { z } from 'zod'
import { prisma } from '@/lib/db'

/**
 * Action runner for automation actions
 * 
 * Each action:
 * - Validates schema with Zod
 * - Enforces tenant scope + permissions
 * - Writes AutomationActionLog
 * - Returns structured result
 */

interface RunActionParams {
  practiceId: string
  runId: string
  actionType: string
  actionArgs: Record<string, any>
  eventData: Record<string, any>
}

interface ActionResult {
  status: 'succeeded' | 'failed' | 'skipped'
  result?: any
  error?: string
}

// Action schemas
const createTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  patientId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
})

const createNoteSchema = z.object({
  patientId: z.string(),
  type: z.enum([
    'general',
    'medical',
    'administrative',
    'billing',
    'appointment',
    'medication',
    'allergy',
    'contact',
    'insurance',
    'other',
  ]),
  content: z.string(),
})

const draftSmsSchema = z.object({
  patientId: z.string(),
  message: z.string(),
  phoneNumber: z.string().optional(), // If not provided, use patient's phone
})

const draftEmailSchema = z.object({
  patientId: z.string(),
  subject: z.string(),
  body: z.string(),
  toEmail: z.string().optional(), // If not provided, use patient's email
})

const updatePatientFieldsSchema = z.object({
  patientId: z.string(),
  fields: z.record(z.any()), // Allowlist enforced in implementation
})

const delaySecondsSchema = z.object({
  seconds: z.number().int().min(0).max(86400), // Max 24 hours
})

const tagPatientSchema = z.object({
  patientId: z.string(),
  tag: z.string().min(1),
})

const updateAppointmentStatusSchema = z.object({
  appointmentId: z.string(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']),
})

const createInsurancePolicySchema = z.object({
  patientId: z.string(),
  providerName: z.string().min(1),
  planName: z.string().optional(),
  memberId: z.string().min(1),
  groupId: z.string().optional(),
  policyHolderName: z.string().min(1),
  policyHolderPhone: z.string().optional(),
  eligibilityStatus: z.enum(['active', 'inactive', 'pending', 'unknown']).default('active'),
})

const sendReminderSchema = z.object({
  patientId: z.string(),
  reminderType: z.enum(['appointment', 'payment', 'follow_up']).default('appointment'),
  message: z.string(),
})

// Allowed fields for update_patient_fields (non-sensitive)
const ALLOWED_PATIENT_FIELDS = [
  'notes',
  'preferredContactMethod',
  'address',
] as const

/**
 * Create a task (draft - not actually creating a Task model yet, just logging)
 */
async function createTask(
  practiceId: string,
  args: z.infer<typeof createTaskSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  // In v1, we just log this action
  // In v2, we'd create an actual Task model
  return {
    status: 'succeeded',
    result: {
      action: 'create_task',
      title: args.title,
      description: args.description,
      patientId: args.patientId,
      dueDate: args.dueDate,
      priority: args.priority || 'medium',
      note: 'Task creation logged (not yet implemented)',
    },
  }
}

/**
 * Create a patient note
 */
async function createNote(
  practiceId: string,
  args: z.infer<typeof createNoteSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  // Verify patient belongs to practice
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  // For automation, we need a system user or use the event's userId if available
  // For now, we'll skip userId (make it optional in schema) or use a system identifier
  // In production, you'd want to track which automation created the note
  const systemUserId = eventData.userId || 'system'

  // Check if user exists, if not skip userId
  const user = await prisma.user.findUnique({
    where: { id: systemUserId },
  })

  if (!user) {
    return {
      status: 'failed',
      error: `User ${systemUserId} not found for note creation`,
    }
  }

  const note = await prisma.patientNote.create({
    data: {
      patientId: args.patientId,
      practiceId,
      userId: systemUserId,
      type: args.type,
      content: args.content,
    },
  })

  return {
    status: 'succeeded',
    result: {
      action: 'create_note',
      noteId: note.id,
      patientId: args.patientId,
    },
  }
}

/**
 * Draft SMS (draft only - not actually sending)
 */
async function draftSms(
  practiceId: string,
  args: z.infer<typeof draftSmsSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  const phoneNumber = args.phoneNumber || patient.phone

  return {
    status: 'succeeded',
    result: {
      action: 'draft_sms',
      patientId: args.patientId,
      phoneNumber,
      message: args.message,
      note: 'SMS drafted (not yet sent)',
    },
  }
}

/**
 * Draft email (draft only - not actually sending)
 */
async function draftEmail(
  practiceId: string,
  args: z.infer<typeof draftEmailSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  const toEmail = args.toEmail || patient.email

  if (!toEmail) {
    return {
      status: 'failed',
      error: 'No email address available for patient',
    }
  }

  return {
    status: 'succeeded',
    result: {
      action: 'draft_email',
      patientId: args.patientId,
      toEmail,
      subject: args.subject,
      body: args.body,
      note: 'Email drafted (not yet sent)',
    },
  }
}

/**
 * Update patient fields (non-sensitive allowlist)
 */
async function updatePatientFields(
  practiceId: string,
  args: z.infer<typeof updatePatientFieldsSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  // Filter to only allowed fields
  const allowedUpdates: Record<string, any> = {}
  for (const field of ALLOWED_PATIENT_FIELDS) {
    if (field in args.fields) {
      allowedUpdates[field] = args.fields[field]
    }
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return {
      status: 'skipped',
      result: {
        action: 'update_patient_fields',
        note: 'No allowed fields to update',
      },
    }
  }

  const updated = await prisma.patient.update({
    where: { id: args.patientId },
    data: allowedUpdates,
  })

  return {
    status: 'succeeded',
    result: {
      action: 'update_patient_fields',
      patientId: args.patientId,
      updatedFields: Object.keys(allowedUpdates),
    },
  }
}

/**
 * Delay action (stub for step.sleep - just logs)
 */
async function delaySeconds(
  practiceId: string,
  args: z.infer<typeof delaySecondsSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  // In Inngest, we'd use step.sleep, but for now we just log
  return {
    status: 'succeeded',
    result: {
      action: 'delay_seconds',
      seconds: args.seconds,
      note: 'Delay logged (use step.sleep in Inngest for actual delay)',
    },
  }
}

/**
 * Tag a patient
 */
async function tagPatient(
  practiceId: string,
  args: z.infer<typeof tagPatientSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  // Use upsert to avoid duplicates
  await prisma.patientTag.upsert({
    where: {
      patientId_tag: {
        patientId: args.patientId,
        tag: args.tag,
      },
    },
    update: {},
    create: {
      patientId: args.patientId,
      tag: args.tag,
    },
  })

  return {
    status: 'succeeded',
    result: {
      action: 'tag_patient',
      patientId: args.patientId,
      tag: args.tag,
    },
  }
}

/**
 * Update appointment status
 */
async function updateAppointmentStatus(
  practiceId: string,
  args: z.infer<typeof updateAppointmentStatusSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: args.appointmentId,
      practiceId,
    },
  })

  if (!appointment) {
    return {
      status: 'failed',
      error: `Appointment ${args.appointmentId} not found or not accessible`,
    }
  }

  const updated = await prisma.appointment.update({
    where: { id: args.appointmentId },
    data: { status: args.status },
  })

  return {
    status: 'succeeded',
    result: {
      action: 'update_appointment_status',
      appointmentId: args.appointmentId,
      newStatus: args.status,
    },
  }
}

/**
 * Create insurance policy
 */
async function createInsurancePolicy(
  practiceId: string,
  args: z.infer<typeof createInsurancePolicySchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  const policy = await prisma.insurancePolicy.create({
    data: {
      practiceId,
      patientId: args.patientId,
      providerName: args.providerName,
      planName: args.planName,
      memberId: args.memberId,
      groupId: args.groupId,
      policyHolderName: args.policyHolderName,
      policyHolderPhone: args.policyHolderPhone,
      eligibilityStatus: args.eligibilityStatus,
    },
  })

  return {
    status: 'succeeded',
    result: {
      action: 'create_insurance_policy',
      policyId: policy.id,
      patientId: args.patientId,
    },
  }
}

/**
 * Send reminder (draft only - not actually sending)
 */
async function sendReminder(
  practiceId: string,
  args: z.infer<typeof sendReminderSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  // In v1, we just log this action
  // In v2, we'd integrate with SMS/Email sending
  return {
    status: 'succeeded',
    result: {
      action: 'send_reminder',
      patientId: args.patientId,
      reminderType: args.reminderType,
      message: args.message,
      note: 'Reminder drafted (not yet sent)',
    },
  }
}

/**
 * Main action runner
 */
export async function runAction(params: RunActionParams): Promise<ActionResult> {
  const { practiceId, runId, actionType, actionArgs, eventData } = params

  let result: ActionResult

  try {
    // Validate and execute based on action type
    switch (actionType) {
      case 'create_task': {
        const validated = createTaskSchema.parse(actionArgs)
        result = await createTask(practiceId, validated, eventData)
        break
      }

      case 'create_note': {
        const validated = createNoteSchema.parse(actionArgs)
        result = await createNote(practiceId, validated, eventData)
        break
      }

      case 'draft_sms': {
        const validated = draftSmsSchema.parse(actionArgs)
        result = await draftSms(practiceId, validated, eventData)
        break
      }

      case 'draft_email': {
        const validated = draftEmailSchema.parse(actionArgs)
        result = await draftEmail(practiceId, validated, eventData)
        break
      }

      case 'update_patient_fields': {
        const validated = updatePatientFieldsSchema.parse(actionArgs)
        result = await updatePatientFields(practiceId, validated, eventData)
        break
      }

      case 'delay_seconds': {
        const validated = delaySecondsSchema.parse(actionArgs)
        result = await delaySeconds(practiceId, validated, eventData)
        break
      }

      case 'tag_patient': {
        const validated = tagPatientSchema.parse(actionArgs)
        result = await tagPatient(practiceId, validated, eventData)
        break
      }

      case 'update_appointment_status': {
        const validated = updateAppointmentStatusSchema.parse(actionArgs)
        result = await updateAppointmentStatus(practiceId, validated, eventData)
        break
      }

      case 'create_insurance_policy': {
        const validated = createInsurancePolicySchema.parse(actionArgs)
        result = await createInsurancePolicy(practiceId, validated, eventData)
        break
      }

      case 'send_reminder': {
        const validated = sendReminderSchema.parse(actionArgs)
        result = await sendReminder(practiceId, validated, eventData)
        break
      }

      default:
        result = {
          status: 'failed',
          error: `Unknown action type: ${actionType}`,
        }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      result = {
        status: 'failed',
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      }
    } else {
      result = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Log the action
  await prisma.automationActionLog.create({
    data: {
      runId,
      practiceId,
      actionType,
      actionArgs,
      actionResult: result.result,
      status: result.status,
      error: result.error,
    },
  })

  return result
}

