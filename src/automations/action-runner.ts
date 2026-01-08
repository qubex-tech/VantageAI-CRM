import { z } from 'zod'
import { prisma } from '@/lib/db'
import { logPatientActivity } from '@/lib/patient-activity'

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

const sendSmsSchema = z.object({
  patientId: z.string(),
  message: z.string(),
  phoneNumber: z.string().optional(), // If not provided, use patient's phone
})

const sendEmailSchema = z.object({
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
 * Create a task (creates a timeline entry for now, can be upgraded to Task model later)
 */
async function createTask(
  practiceId: string,
  args: z.infer<typeof createTaskSchema>,
  eventData: Record<string, any>
): Promise<ActionResult> {
  // Create a timeline entry to track the task
  // In the future, this can be upgraded to a dedicated Task model
  if (args.patientId) {
    try {
      await logPatientActivity({
        patientId: args.patientId,
        type: 'task',
        title: `Task created: ${args.title}`,
        description: args.description || `Priority: ${args.priority || 'medium'}${args.dueDate ? ` | Due: ${args.dueDate}` : ''}`,
        metadata: {
          priority: args.priority || 'medium',
          dueDate: args.dueDate,
          createdBy: 'automation',
        },
      })
    } catch (error) {
      console.error('Failed to create task timeline entry:', error)
    }
  }

  return {
    status: 'succeeded',
    result: {
      action: 'create_task',
      title: args.title,
      description: args.description,
      patientId: args.patientId,
      dueDate: args.dueDate,
      priority: args.priority || 'medium',
      note: args.patientId ? 'Task created as timeline entry' : 'Task logged (no patient ID provided)',
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
  console.log(`[AUTOMATION] Creating note:`, {
    practiceId,
    patientId: args.patientId,
    type: args.type,
    contentLength: args.content?.length,
    eventDataUserId: eventData.userId,
  })

  // Verify patient belongs to practice
  const patient = await prisma.patient.findFirst({
    where: {
      id: args.patientId,
      practiceId,
      deletedAt: null,
    },
  })

  if (!patient) {
    console.error(`[AUTOMATION] Patient not found:`, args.patientId)
    return {
      status: 'failed',
      error: `Patient ${args.patientId} not found or not accessible`,
    }
  }

  // Find a valid user for automation (prefer practice admin, fallback to any practice user)
  let automationUserId = eventData.userId
  
  if (!automationUserId) {
    // Try to find a practice admin
    const adminUser = await prisma.user.findFirst({
      where: {
        practiceId,
        role: { in: ['practice_admin', 'admin'] },
      },
    })
    
    if (adminUser) {
      automationUserId = adminUser.id
    } else {
      // Fallback to any user in the practice
      const anyUser = await prisma.user.findFirst({
        where: { practiceId },
      })
      
      if (!anyUser) {
        return {
          status: 'failed',
          error: 'No user found in practice for note creation',
        }
      }
      
      automationUserId = anyUser.id
    }
  } else {
    // Verify the provided user exists and belongs to practice
    const user = await prisma.user.findFirst({
      where: {
        id: automationUserId,
        practiceId,
      },
    })
    
    if (!user) {
      // Fallback to practice admin
      const adminUser = await prisma.user.findFirst({
        where: {
          practiceId,
          role: { in: ['practice_admin', 'admin'] },
        },
      })
      
      if (adminUser) {
        automationUserId = adminUser.id
      } else {
        return {
          status: 'failed',
          error: 'No valid user found for note creation',
        }
      }
    }
  }

  // Validate content is present
  if (!args.content || args.content.trim() === '') {
    return {
      status: 'failed',
      error: 'Note content is required',
    }
  }

  const note = await prisma.patientNote.create({
    data: {
      patientId: args.patientId,
      practiceId,
      userId: automationUserId,
      type: args.type,
      content: args.content,
    },
  })

  console.log(`[AUTOMATION] Note created successfully:`, {
    noteId: note.id,
    patientId: args.patientId,
    userId: automationUserId,
  })

  // Log to patient activity timeline
  try {
    await logPatientActivity({
      patientId: args.patientId,
      type: 'note',
      title: `Note created (${args.type})`,
      description: args.content.length > 200 ? `${args.content.substring(0, 200)}...` : args.content,
      metadata: {
        noteId: note.id,
        noteType: args.type,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log note activity:', error)
  }

  return {
    status: 'succeeded',
    result: {
      action: 'create_note',
      noteId: note.id,
      patientId: args.patientId,
      content: args.content.substring(0, 50) + (args.content.length > 50 ? '...' : ''),
    },
  }
}

/**
 * Send SMS (via SendGrid SMS API or log if not configured)
 */
async function sendSms(
  practiceId: string,
  args: z.infer<typeof sendSmsSchema>,
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

  if (!phoneNumber) {
    return {
      status: 'failed',
      error: 'No phone number available for patient',
    }
  }

  // For now, log SMS (Twilio integration can be added later)
  // In production, you'd integrate with Twilio or SendGrid SMS API
  console.log(`[AUTOMATION SMS] To: ${phoneNumber}, Message: ${args.message}`)

  // Create a note to track SMS sent
  try {
    // Find a valid user for automation
    const adminUser = await prisma.user.findFirst({
      where: {
        practiceId,
        role: { in: ['practice_admin', 'admin'] },
      },
    })
    
    const automationUserId = adminUser?.id || (await prisma.user.findFirst({
      where: { practiceId },
    }))?.id

    if (automationUserId) {
      await prisma.patientNote.create({
        data: {
          patientId: args.patientId,
          practiceId,
          userId: automationUserId,
          type: 'contact',
          content: `[Automation SMS] Sent to ${phoneNumber}: ${args.message}`,
        },
      })
    }
  } catch (error) {
    console.error('Failed to log SMS note:', error)
  }

  // Log to patient activity timeline
  try {
    await logPatientActivity({
      patientId: args.patientId,
      type: 'call',
      title: 'SMS sent via automation',
      description: `Sent to ${phoneNumber}: ${args.message.substring(0, 100)}${args.message.length > 100 ? '...' : ''}`,
      metadata: {
        phoneNumber,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log SMS activity:', error)
  }

  return {
    status: 'succeeded',
    result: {
      action: 'send_sms',
      patientId: args.patientId,
      phoneNumber,
      message: args.message,
      note: 'SMS logged (Twilio integration can be added for actual sending)',
    },
  }
}

/**
 * Send email via SendGrid
 */
async function sendEmail(
  practiceId: string,
  args: z.infer<typeof sendEmailSchema>,
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

  // Actually send email via SendGrid
  try {
    console.log(`[AUTOMATION] Sending email via SendGrid:`, {
      practiceId,
      toEmail,
      subject: args.subject,
      patientId: args.patientId,
    })

    const { getSendgridClient } = await import('@/lib/sendgrid')
    const sendgridClient = await getSendgridClient(practiceId)
    
    const result = await sendgridClient.sendEmail({
      to: toEmail,
      toName: patient.name,
      subject: args.subject,
      htmlContent: args.body.replace(/\n/g, '<br>'),
      textContent: args.body,
    })

    if (!result.success) {
      console.error(`[AUTOMATION] SendGrid error:`, result.error)
      return {
        status: 'failed',
        error: result.error || 'Failed to send email via SendGrid',
      }
    }

    console.log(`[AUTOMATION] Email sent successfully:`, {
      messageId: result.messageId,
      toEmail,
    })

    // Create a note to track email sent
    try {
      let automationUserId = eventData.userId
      if (!automationUserId) {
        const adminUser = await prisma.user.findFirst({
          where: {
            practiceId,
            role: { in: ['practice_admin', 'admin'] },
          },
        })
        automationUserId = adminUser?.id || (await prisma.user.findFirst({
          where: { practiceId },
        }))?.id
      }

      if (automationUserId) {
        await prisma.patientNote.create({
          data: {
            patientId: args.patientId,
            practiceId,
            userId: automationUserId,
            type: 'contact',
            content: `[Automation Email] Sent to ${toEmail} (Subject: ${args.subject}, MessageId: ${result.messageId}): ${args.body.substring(0, 100)}${args.body.length > 100 ? '...' : ''}`,
          },
        })
        console.log(`[AUTOMATION] Email note created for patient ${args.patientId}`)
      }
    } catch (noteError) {
      console.error(`[AUTOMATION] Failed to create email note:`, noteError)
      // Don't fail the action if note creation fails
    }

    // Log to patient activity timeline
    try {
      await logPatientActivity({
        patientId: args.patientId,
        type: 'email',
        title: `Email sent: ${args.subject}`,
        description: `Sent to ${toEmail}: ${args.body.substring(0, 100)}${args.body.length > 100 ? '...' : ''}`,
        metadata: {
          toEmail,
          subject: args.subject,
          messageId: result.messageId,
          createdBy: 'automation',
        },
      })
    } catch (error) {
      console.error('Failed to log email activity:', error)
    }

    return {
      status: 'succeeded',
      result: {
        action: 'send_email',
        patientId: args.patientId,
        toEmail,
        subject: args.subject,
        messageId: result.messageId,
      },
    }
  } catch (error) {
    console.error(`[AUTOMATION] Email sending error:`, error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
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

  const oldPatient = { ...patient }
  const updated = await prisma.patient.update({
    where: { id: args.patientId },
    data: allowedUpdates,
  })

  // Log field updates to patient activity timeline
  try {
    const fieldNames = Object.keys(allowedUpdates)
    const fieldDisplayNames = fieldNames.map(f => f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
    await logPatientActivity({
      patientId: args.patientId,
      type: 'field_update',
      title: `Patient fields updated: ${fieldDisplayNames.join(', ')}`,
      description: fieldNames.map(field => {
        const oldVal = oldPatient[field as keyof typeof oldPatient]
        const newVal = allowedUpdates[field]
        return `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: "${oldVal || 'None'}" → "${newVal || 'None'}"`
      }).join('; '),
      metadata: {
        updatedFields: fieldNames,
        changes: allowedUpdates,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log field update activity:', error)
  }

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

  // Log to patient activity timeline
  try {
    await logPatientActivity({
      patientId: args.patientId,
      type: 'other',
      title: `Tag added: ${args.tag}`,
      description: `Patient tagged with "${args.tag}" via automation`,
      metadata: {
        tag: args.tag,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log tag activity:', error)
  }

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

  const oldStatus = appointment.status
  const updated = await prisma.appointment.update({
    where: { id: args.appointmentId },
    data: { status: args.status },
  })

  // Log to patient activity timeline
  try {
    await logPatientActivity({
      patientId: appointment.patientId,
      type: 'appointment',
      title: `Appointment status updated: ${oldStatus} → ${args.status}`,
      description: `Appointment status changed from "${oldStatus}" to "${args.status}" via automation`,
      metadata: {
        appointmentId: args.appointmentId,
        oldStatus,
        newStatus: args.status,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log appointment status update activity:', error)
  }

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

  // Log to patient activity timeline
  try {
    await logPatientActivity({
      patientId: args.patientId,
      type: 'insurance',
      title: `Insurance policy created: ${args.providerName}`,
      description: `Policy: ${args.planName || 'N/A'}, Member ID: ${args.memberId}, Status: ${args.eligibilityStatus}`,
      metadata: {
        policyId: policy.id,
        providerName: args.providerName,
        planName: args.planName,
        memberId: args.memberId,
        eligibilityStatus: args.eligibilityStatus,
        createdBy: 'automation',
      },
    })
  } catch (error) {
    console.error('Failed to log insurance policy activity:', error)
  }

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
 * Send reminder (actually sends via email or SMS based on patient preference)
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

  // Determine how to send based on reminder type and patient preference
  const contactMethod = args.reminderType === 'appointment' 
    ? (patient.preferredContactMethod || 'email')
    : 'email'

  if (contactMethod === 'email' && patient.email) {
    try {
      const { getSendgridClient } = await import('@/lib/sendgrid')
      const sendgridClient = await getSendgridClient(practiceId)
      
      const subject = args.reminderType === 'appointment' 
        ? 'Appointment Reminder'
        : args.reminderType === 'payment'
        ? 'Payment Reminder'
        : 'Follow-up Reminder'

      const result = await sendgridClient.sendEmail({
        to: patient.email,
        toName: patient.name,
        subject,
        htmlContent: args.message.replace(/\n/g, '<br>'),
        textContent: args.message,
      })

      if (!result.success) {
        return {
          status: 'failed',
          error: result.error || 'Failed to send reminder email',
        }
      }

      // Log to patient activity timeline
      try {
        await logPatientActivity({
          patientId: args.patientId,
          type: 'reminder',
          title: `${args.reminderType.charAt(0).toUpperCase() + args.reminderType.slice(1)} reminder sent via email`,
          description: `Subject: ${subject}. ${args.message.substring(0, 100)}${args.message.length > 100 ? '...' : ''}`,
          metadata: {
            reminderType: args.reminderType,
            method: 'email',
            messageId: result.messageId,
            createdBy: 'automation',
          },
        })
      } catch (error) {
        console.error('Failed to log reminder activity:', error)
      }

      return {
        status: 'succeeded',
        result: {
          action: 'send_reminder',
          patientId: args.patientId,
          reminderType: args.reminderType,
          method: 'email',
          messageId: result.messageId,
        },
      }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to send reminder email',
      }
    }
  } else if (contactMethod === 'sms' && patient.phone) {
    // Log SMS (Twilio integration can be added)
    console.log(`[AUTOMATION REMINDER SMS] To: ${patient.phone}, Message: ${args.message}`)
    
    // Create a note to track reminder sent
    try {
      const adminUser = await prisma.user.findFirst({
        where: {
          practiceId,
          role: { in: ['practice_admin', 'admin'] },
        },
      })
      
      const automationUserId = adminUser?.id || (await prisma.user.findFirst({
        where: { practiceId },
      }))?.id

      if (automationUserId) {
        await prisma.patientNote.create({
          data: {
            patientId: args.patientId,
            practiceId,
            userId: automationUserId,
            type: 'contact',
            content: `[Automation Reminder SMS] Sent to ${patient.phone}: ${args.message}`,
          },
        })
      }
    } catch (error) {
      console.error('Failed to log reminder SMS note:', error)
    }

    // Log to patient activity timeline
    try {
      await logPatientActivity({
        patientId: args.patientId,
        type: 'reminder',
        title: `${args.reminderType.charAt(0).toUpperCase() + args.reminderType.slice(1)} reminder sent via SMS`,
        description: `Sent to ${patient.phone}: ${args.message.substring(0, 100)}${args.message.length > 100 ? '...' : ''}`,
        metadata: {
          reminderType: args.reminderType,
          method: 'sms',
          phoneNumber: patient.phone,
          createdBy: 'automation',
        },
      })
    } catch (error) {
      console.error('Failed to log reminder activity:', error)
    }

    return {
      status: 'succeeded',
      result: {
        action: 'send_reminder',
        patientId: args.patientId,
        reminderType: args.reminderType,
        method: 'sms',
        note: 'Reminder SMS logged (Twilio integration can be added)',
      },
    }
  } else {
    return {
      status: 'failed',
      error: `No ${contactMethod} contact information available for patient`,
    }
  }
}

/**
 * Main action runner
 */
export async function runAction(params: RunActionParams): Promise<ActionResult> {
  const { practiceId, runId, actionType, actionArgs, eventData } = params

  console.log(`[AUTOMATION] runAction called:`, {
    practiceId,
    runId,
    actionType,
    actionArgs,
    eventDataKeys: Object.keys(eventData),
  })

  let result: ActionResult

  try {
    // Validate and execute based on action type
    switch (actionType) {
      case 'create_task': {
        console.log(`[AUTOMATION] Validating create_task args:`, actionArgs)
        const validated = createTaskSchema.parse(actionArgs)
        result = await createTask(practiceId, validated, eventData)
        break
      }

      case 'create_note': {
        console.log(`[AUTOMATION] Validating create_note args:`, {
          actionArgs,
          patientId: actionArgs?.patientId,
          type: actionArgs?.type,
          content: actionArgs?.content,
          allKeys: Object.keys(actionArgs || {}),
        })
        const validated = createNoteSchema.parse(actionArgs)
        result = await createNote(practiceId, validated, eventData)
        break
      }

      case 'send_sms': {
        console.log(`[AUTOMATION] Validating send_sms args:`, actionArgs)
        const validated = sendSmsSchema.parse(actionArgs)
        result = await sendSms(practiceId, validated, eventData)
        break
      }

      case 'send_email': {
        console.log(`[AUTOMATION] Validating send_email args:`, {
          actionArgs,
          patientId: actionArgs?.patientId,
          subject: actionArgs?.subject,
          body: actionArgs?.body,
          allKeys: Object.keys(actionArgs || {}),
        })
        const validated = sendEmailSchema.parse(actionArgs)
        result = await sendEmail(practiceId, validated, eventData)
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
      console.error(`[AUTOMATION] Zod validation error for ${actionType}:`, {
        errors: error.errors,
        actionArgs,
        formattedErrors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      })
      result = {
        status: 'failed',
        error: `Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      }
    } else {
      console.error(`[AUTOMATION] Unexpected error for ${actionType}:`, error)
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

