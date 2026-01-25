// Pre-designed template library for quick starts
// These templates match Klaviyo's professional template offerings

import { EmailDoc } from './types'

interface BaseTemplateLibraryItem {
  id: string
  name: string
  description: string
  category: string
  channel: 'email' | 'sms'
  thumbnail?: string
  preview?: string
  tags: string[]
}

export interface EmailTemplateLibraryItem extends BaseTemplateLibraryItem {
  channel: 'email'
  template: EmailDoc
}

export interface SmsTemplateLibraryItem extends BaseTemplateLibraryItem {
  channel: 'sms'
  bodyText: string
}

export type TemplateLibraryItem = EmailTemplateLibraryItem | SmsTemplateLibraryItem

export const TEMPLATE_LIBRARY: TemplateLibraryItem[] = [
  // Appointment Reminder Email
  {
    id: 'appointment-reminder-email',
    name: 'Appointment Reminder',
    description: 'Professional appointment reminder with date, time, and location',
    category: 'reminder',
    channel: 'email',
    tags: ['appointment', 'reminder', 'healthcare'],
    template: {
      rows: [
        {
          id: 'row-header',
          columns: [
            {
              id: 'col-header',
              width: 100,
              blocks: [
                { type: 'header', logo: true },
              ],
            },
          ],
        },
        {
          id: 'row-hero',
          columns: [
            {
              id: 'col-hero',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<h1 style="text-align: center; font-size: 28px; margin-bottom: 16px;">Upcoming Appointment</h1><p style="text-align: center; font-size: 16px; color: #666;">We look forward to seeing you!</p>',
                  style: {
                    padding: '40px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-details',
          columns: [
            {
              id: 'col-details',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<p style="font-size: 16px; line-height: 1.6;"><strong>Date:</strong> {{appointment.date}}</p><p style="font-size: 16px; line-height: 1.6;"><strong>Time:</strong> {{appointment.time}}</p><p style="font-size: 16px; line-height: 1.6;"><strong>Provider:</strong> {{appointment.providerName}}</p><p style="font-size: 16px; line-height: 1.6;"><strong>Location:</strong> {{appointment.location}}</p>',
                  style: {
                    padding: '30px 20px',
                    backgroundColor: '#f9fafb',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-cta',
          columns: [
            {
              id: 'col-cta',
              width: 100,
              blocks: [
                {
                  type: 'button',
                  label: 'Confirm Appointment',
                  url: '{{links.confirm}}',
                  style: {
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff',
                    borderRadius: '6px',
                    padding: '14px 28px',
                  },
                },
                {
                  type: 'spacer',
                  height: '20px',
                },
                {
                  type: 'text',
                  content: '<p style="text-align: center; font-size: 14px; color: #666;"><a href="{{links.reschedule}}" style="color: #2563eb;">Reschedule</a> | <a href="{{links.cancel}}" style="color: #dc2626;">Cancel</a></p>',
                  style: {
                    padding: '10px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-footer',
          columns: [
            {
              id: 'col-footer',
              width: 100,
              blocks: [
                { type: 'footer', showUnsubscribe: true },
              ],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: 'Arial',
        primaryColor: '#2563eb',
        buttonColor: '#2563eb',
        linkColor: '#2563eb',
      },
    },
  },
  // Welcome Email
  {
    id: 'welcome-email',
    name: 'Welcome Email',
    description: 'Warm welcome email for new patients',
    category: 'broadcast',
    channel: 'email',
    tags: ['welcome', 'onboarding', 'new-patient'],
    template: {
      rows: [
        {
          id: 'row-header',
          columns: [
            {
              id: 'col-header',
              width: 100,
              blocks: [
                { type: 'header', logo: true },
              ],
            },
          ],
        },
        {
          id: 'row-hero',
          columns: [
            {
              id: 'col-hero',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<h1 style="text-align: center; font-size: 32px; margin-bottom: 16px;">Welcome, {{patient.firstName}}!</h1><p style="text-align: center; font-size: 18px; color: #666;">We\'re excited to have you as part of our practice.</p>',
                  style: {
                    padding: '50px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-content',
          columns: [
            {
              id: 'col-content',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<p style="font-size: 16px; line-height: 1.8;">Thank you for choosing {{practice.name}}. We\'re committed to providing you with the highest quality care.</p><p style="font-size: 16px; line-height: 1.8;">Here\'s what you can expect:</p><ul style="font-size: 16px; line-height: 1.8;"><li>Personalized care tailored to your needs</li><li>Easy appointment scheduling</li><li>Secure patient portal access</li><li>Timely communication</li></ul>',
                  style: {
                    padding: '30px 20px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-cta',
          columns: [
            {
              id: 'col-cta',
              width: 100,
              blocks: [
                {
                  type: 'button',
                  label: 'Access Patient Portal',
                  url: '{{links.portalVerified}}',
                  style: {
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff',
                    borderRadius: '6px',
                    padding: '14px 28px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-footer',
          columns: [
            {
              id: 'col-footer',
              width: 100,
              blocks: [
                { type: 'footer', showUnsubscribe: true },
              ],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: 'Arial',
        primaryColor: '#2563eb',
        buttonColor: '#2563eb',
        linkColor: '#2563eb',
      },
    },
  },
  // Appointment Confirmation
  {
    id: 'appointment-confirmation-email',
    name: 'Appointment Confirmation',
    description: 'Confirmation email after booking an appointment',
    category: 'confirmation',
    channel: 'email',
    tags: ['appointment', 'confirmation', 'booking'],
    template: {
      rows: [
        {
          id: 'row-header',
          columns: [
            {
              id: 'col-header',
              width: 100,
              blocks: [
                { type: 'header', logo: true },
              ],
            },
          ],
        },
        {
          id: 'row-hero',
          columns: [
            {
              id: 'col-hero',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<h1 style="text-align: center; font-size: 28px; margin-bottom: 16px; color: #059669;">✓ Appointment Confirmed</h1><p style="text-align: center; font-size: 16px; color: #666;">Your appointment has been successfully scheduled</p>',
                  style: {
                    padding: '40px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-details',
          columns: [
            {
              id: 'col-details',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0;"><p style="font-size: 16px; line-height: 1.6; margin: 8px 0;"><strong>Date:</strong> {{appointment.date}}</p><p style="font-size: 16px; line-height: 1.6; margin: 8px 0;"><strong>Time:</strong> {{appointment.time}}</p><p style="font-size: 16px; line-height: 1.6; margin: 8px 0;"><strong>Provider:</strong> {{appointment.providerName}}</p><p style="font-size: 16px; line-height: 1.6; margin: 8px 0;"><strong>Location:</strong> {{appointment.location}}</p></div>',
                  style: {
                    padding: '20px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-actions',
          columns: [
            {
              id: 'col-actions',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<p style="text-align: center; font-size: 14px; color: #666;">Need to make changes?</p>',
                  style: {
                    padding: '10px 20px',
                    textAlign: 'center',
                  },
                },
                {
                  type: 'text',
                  content: '<p style="text-align: center; font-size: 14px;"><a href="{{links.reschedule}}" style="color: #2563eb; margin: 0 10px;">Reschedule</a> | <a href="{{links.cancel}}" style="color: #dc2626; margin: 0 10px;">Cancel</a></p>',
                  style: {
                    padding: '10px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-footer',
          columns: [
            {
              id: 'col-footer',
              width: 100,
              blocks: [
                { type: 'footer', showUnsubscribe: true },
              ],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: 'Arial',
        primaryColor: '#059669',
        buttonColor: '#059669',
        linkColor: '#2563eb',
      },
    },
  },
  // Follow-up Email
  {
    id: 'followup-email',
    name: 'Follow-up Email',
    description: 'Post-visit follow-up with care instructions',
    category: 'followup',
    channel: 'email',
    tags: ['follow-up', 'care', 'instructions'],
    template: {
      rows: [
        {
          id: 'row-header',
          columns: [
            {
              id: 'col-header',
              width: 100,
              blocks: [
                { type: 'header', logo: true },
              ],
            },
          ],
        },
        {
          id: 'row-hero',
          columns: [
            {
              id: 'col-hero',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<h1 style="text-align: center; font-size: 28px; margin-bottom: 16px;">How are you feeling?</h1><p style="text-align: center; font-size: 16px; color: #666;">We hope your visit went well</p>',
                  style: {
                    padding: '40px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-content',
          columns: [
            {
              id: 'col-content',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<p style="font-size: 16px; line-height: 1.8;">Hi {{patient.firstName}},</p><p style="font-size: 16px; line-height: 1.8;">Thank you for visiting us. We wanted to check in and make sure you have everything you need.</p><p style="font-size: 16px; line-height: 1.8;">If you have any questions or concerns, please don\'t hesitate to reach out to us.</p>',
                  style: {
                    padding: '30px 20px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-cta',
          columns: [
            {
              id: 'col-cta',
              width: 100,
              blocks: [
                {
                  type: 'button',
                  label: 'Contact Us',
                  url: 'mailto:{{practice.email}}',
                  style: {
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff',
                    borderRadius: '6px',
                    padding: '14px 28px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-footer',
          columns: [
            {
              id: 'col-footer',
              width: 100,
              blocks: [
                { type: 'footer', showUnsubscribe: true },
              ],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: 'Arial',
        primaryColor: '#2563eb',
        buttonColor: '#2563eb',
        linkColor: '#2563eb',
      },
    },
  },
  // Review Request Email
  {
    id: 'review-request-email',
    name: 'Review Request',
    description: 'Request patient reviews and feedback',
    category: 'reviews',
    channel: 'email',
    tags: ['review', 'feedback', 'rating'],
    template: {
      rows: [
        {
          id: 'row-header',
          columns: [
            {
              id: 'col-header',
              width: 100,
              blocks: [
                { type: 'header', logo: true },
              ],
            },
          ],
        },
        {
          id: 'row-hero',
          columns: [
            {
              id: 'col-hero',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<h1 style="text-align: center; font-size: 28px; margin-bottom: 16px;">How was your experience?</h1><p style="text-align: center; font-size: 16px; color: #666;">Your feedback helps us improve</p>',
                  style: {
                    padding: '40px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-content',
          columns: [
            {
              id: 'col-content',
              width: 100,
              blocks: [
                {
                  type: 'text',
                  content: '<p style="font-size: 16px; line-height: 1.8; text-align: center;">Hi {{patient.firstName}},</p><p style="font-size: 16px; line-height: 1.8; text-align: center;">We\'d love to hear about your recent visit. Your feedback helps us provide better care to all our patients.</p>',
                  style: {
                    padding: '30px 20px',
                    textAlign: 'center',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-cta',
          columns: [
            {
              id: 'col-cta',
              width: 100,
              blocks: [
                {
                  type: 'button',
                  label: 'Leave a Review',
                  url: '#',
                  style: {
                    backgroundColor: '#2563eb',
                    textColor: '#ffffff',
                    borderRadius: '6px',
                    padding: '14px 28px',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'row-footer',
          columns: [
            {
              id: 'col-footer',
              width: 100,
              blocks: [
                { type: 'footer', showUnsubscribe: true },
              ],
            },
          ],
        },
      ],
      globalStyles: {
        fontFamily: 'Arial',
        primaryColor: '#2563eb',
        buttonColor: '#2563eb',
        linkColor: '#2563eb',
      },
    },
  },
  // Appointment Reminder SMS
  {
    id: 'appointment-reminder-sms',
    name: 'Appointment Reminder (SMS)',
    description: 'Short reminder with date/time and quick actions',
    category: 'reminder',
    channel: 'sms',
    tags: ['appointment', 'reminder', 'sms'],
    bodyText:
      'Hi {{patient.firstName}}, reminder: your appointment is {{appointment.date}} at {{appointment.time}} with {{practice.name}}. Confirm: {{links.confirm}}. Reply STOP to opt out.',
  },
  // Appointment Confirmation SMS
  {
    id: 'appointment-confirmation-sms',
    name: 'Appointment Confirmation (SMS)',
    description: 'Confirmation message right after booking',
    category: 'confirmation',
    channel: 'sms',
    tags: ['appointment', 'confirmation', 'sms'],
    bodyText:
      'Thanks {{patient.firstName}}! Your appointment is confirmed for {{appointment.date}} at {{appointment.time}}. Need changes? {{links.reschedule}}. Reply STOP to opt out.',
  },
  // Review Request SMS
  {
    id: 'review-request-sms',
    name: 'Review Request (SMS)',
    description: 'Quick review request with link',
    category: 'reviews',
    channel: 'sms',
    tags: ['review', 'feedback', 'sms'],
    bodyText:
      'Hi {{patient.firstName}}, thanks for visiting {{practice.name}}. Please share your feedback: {{links.confirm}}. Reply STOP to opt out.',
  },
]

// Get templates by category
export function getTemplatesByCategory(category: string): TemplateLibraryItem[] {
  return TEMPLATE_LIBRARY.filter((t) => t.category === category)
}

// Get templates by channel
export function getTemplatesByChannel(channel: 'email' | 'sms'): TemplateLibraryItem[] {
  return TEMPLATE_LIBRARY.filter((t) => t.channel === channel)
}

// Get template by ID
export function getTemplateById(id: string): TemplateLibraryItem | undefined {
  return TEMPLATE_LIBRARY.find((t) => t.id === id)
}
