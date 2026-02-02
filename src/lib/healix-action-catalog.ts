export type HealixActionCatalogEntry = {
  id: string
  label: string
  description: string
  toolName?: string
  requiredArgs?: string[]
  example?: string
  executable: boolean
}

export const HEALIX_ACTION_CATALOG: HealixActionCatalogEntry[] = [
  {
    id: 'create-task',
    label: 'Create internal task',
    description: 'Create a staff task tied to a patient or appointment.',
    toolName: 'createTask',
    requiredArgs: ['patientId|appointmentId', 'title'],
    example: 'Create a task to call the patient tomorrow.',
    executable: true,
  },
  {
    id: 'create-note',
    label: 'Add patient note',
    description: 'Add a note to the patient timeline.',
    toolName: 'createNote',
    requiredArgs: ['patientId|appointmentId', 'content'],
    example: 'Add a note about insurance follow-up.',
    executable: true,
  },
  {
    id: 'draft-message',
    label: 'Draft patient message',
    description: 'Draft an email or SMS for a patient (use only when the user asks for a draft).',
    toolName: 'draftMessage',
    requiredArgs: ['patientId', 'channel', 'content'],
    example: 'Draft an SMS confirming next appointment.',
    executable: true,
  },
  {
    id: 'update-patient-fields',
    label: 'Update patient preferences',
    description: 'Update non-sensitive patient fields (preferred contact, language, marketing opt-in).',
    toolName: 'updatePatientFields',
    requiredArgs: ['patientId', 'patch'],
    example: 'Update preferred contact method to SMS.',
    executable: true,
  },
  {
    id: 'send-portal-invite',
    label: 'Send patient portal invite',
    description: 'Send a secure portal invite via email or SMS.',
    toolName: 'sendPortalInvite',
    requiredArgs: ['patientId', 'channel'],
    example: 'Send a portal invite via SMS.',
    executable: true,
  },
  {
    id: 'list-form-templates',
    label: 'List form templates',
    description: 'List available form templates for intake, insurance, and updates.',
    toolName: 'listFormTemplates',
    requiredArgs: [],
    example: 'Show me available intake forms.',
    executable: true,
  },
  {
    id: 'request-form-completion',
    label: 'Request form completion',
    description: 'Create a form request and optionally send a notification with a link.',
    toolName: 'requestFormCompletion',
    requiredArgs: ['patientId', 'formTemplateId'],
    example: 'Send an insurance update form via SMS.',
    executable: true,
  },
  {
    id: 'send-sms',
    label: 'Send SMS',
    description: 'Send a direct SMS to a patient (use when the user asks to send; requires Twilio).',
    toolName: 'sendSms',
    requiredArgs: ['patientId|patientName', 'message'],
    example: 'Text the patient to confirm we received their documents.',
    executable: true,
  },
  {
    id: 'schedule-appointment',
    label: 'Schedule appointment',
    description: 'Book a new appointment and send confirmations.',
    example: 'Schedule a 30-min follow-up next Tuesday morning.',
    executable: false,
  },
  {
    id: 'reschedule-appointment',
    label: 'Reschedule appointment',
    description: 'Move an appointment to a new time and notify the patient.',
    example: 'Reschedule the appointment to Thursday at 2pm.',
    executable: false,
  },
  {
    id: 'cancel-appointment',
    label: 'Cancel appointment',
    description: 'Cancel an appointment and notify the patient.',
    example: 'Cancel the appointment and notify the patient.',
    executable: false,
  },
  {
    id: 'collect-payment',
    label: 'Collect payment',
    description: 'Initiate a payment collection workflow and send a payment link.',
    example: 'Send a payment link for the outstanding balance.',
    executable: false,
  },
  {
    id: 'update-insurance',
    label: 'Update insurance details',
    description: 'Update insurance policy information for the patient.',
    example: 'Update insurance policy number and provider.',
    executable: false,
  },
]

export function formatHealixActionCatalog(): string {
  return HEALIX_ACTION_CATALOG.map((action) => {
    const lines = [
      `- ${action.label}${action.toolName ? ` (tool: ${action.toolName})` : ''}`,
      `  ${action.description}`,
    ]
    if (action.requiredArgs && action.requiredArgs.length > 0) {
      lines.push(`  Required: ${action.requiredArgs.join(', ')}`)
    }
    if (action.example) {
      lines.push(`  Example: ${action.example}`)
    }
    if (!action.executable) {
      lines.push(`  Note: Not executable yet; suggest a task or ask for clarification.`)
    }
    return lines.join('\n')
  }).join('\n')
}
