export type FormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

export interface FormFieldDefinition {
  id: string
  label: string
  type: FormFieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  helperText?: string
}

export interface FormTemplateSeed {
  name: string
  description: string
  category: 'intake' | 'consent' | 'medical_history' | 'custom'
  schema: {
    version: number
    fields: FormFieldDefinition[]
  }
}

export const defaultFormTemplates: FormTemplateSeed[] = [
  {
    name: 'Patient Intake',
    description: 'Collect demographics, contact details, and visit reasons.',
    category: 'intake',
    schema: {
      version: 1,
      fields: [
        { id: 'preferred_name', label: 'Preferred name', type: 'text' },
        { id: 'date_of_birth', label: 'Date of birth', type: 'date', required: true },
        { id: 'primary_phone', label: 'Primary phone', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'address', label: 'Street address', type: 'text' },
        { id: 'reason_for_visit', label: 'Reason for visit', type: 'textarea', required: true },
        { id: 'preferred_contact', label: 'Preferred contact method', type: 'select', options: ['Phone', 'Email', 'SMS'] },
      ],
    },
  },
  {
    name: 'Medical History',
    description: 'Capture allergies, medications, and past procedures.',
    category: 'medical_history',
    schema: {
      version: 1,
      fields: [
        { id: 'allergies', label: 'Allergies', type: 'textarea' },
        { id: 'medications', label: 'Current medications', type: 'textarea' },
        { id: 'conditions', label: 'Chronic conditions', type: 'textarea' },
        { id: 'surgeries', label: 'Past surgeries', type: 'textarea' },
        { id: 'family_history', label: 'Family history', type: 'textarea' },
      ],
    },
  },
  {
    name: 'Consent to Treat',
    description: 'Digital consent for treatment and data sharing.',
    category: 'consent',
    schema: {
      version: 1,
      fields: [
        {
          id: 'consent_treatment',
          label: 'I consent to receive treatment from this practice.',
          type: 'checkbox',
          required: true,
        },
        {
          id: 'consent_data',
          label: 'I consent to the sharing of my medical data for care coordination.',
          type: 'checkbox',
          required: true,
        },
        { id: 'signature_name', label: 'Full name', type: 'text', required: true },
        { id: 'signature_date', label: 'Date', type: 'date', required: true },
      ],
    },
  },
]

export async function seedDefaultFormTemplates(practiceId: string, userId: string) {
  const { prisma } = await import('@/lib/db')

  const existing = await prisma.formTemplate.findFirst({
    where: {
      practiceId,
      isSystem: true,
    },
    select: { id: true },
  })

  if (existing) {
    return
  }

  await prisma.formTemplate.createMany({
    data: defaultFormTemplates.map((template) => ({
      practiceId,
      name: template.name,
      description: template.description,
      category: template.category,
      status: 'published',
      schema: template.schema,
      isSystem: true,
      createdByUserId: userId,
    })),
  })
}
