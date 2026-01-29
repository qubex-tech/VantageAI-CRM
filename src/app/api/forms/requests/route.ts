import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/middleware'
import { emitEvent } from '@/lib/outbox'
import { getOrCreateVerifiedPatientPortalUrl, getVerifiedFormRequestPortalUrl } from '@/lib/patient-auth'
import { renderEmailFromJson } from '@/lib/marketing/render-email'
import { replaceVariables } from '@/lib/marketing/variables'
import type { VariableContext } from '@/lib/marketing/types'
import { getSendgridClient } from '@/lib/sendgrid'
import { getTwilioClient } from '@/lib/twilio'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const requests = await prisma.formRequest.findMany({
      where: { practiceId: user.practiceId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        patient: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required for this operation' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      patientId,
      formTemplateId,
      dueDate,
      message,
      notifyChannel,
      notificationTemplateId,
    } = body

    if (!patientId || !formTemplateId) {
      return NextResponse.json(
        { error: 'Patient ID and template ID are required' },
        { status: 400 }
      )
    }

    const request = await prisma.formRequest.create({
      data: {
        practiceId: user.practiceId,
        patientId,
        formTemplateId,
        dueDate: dueDate ? new Date(dueDate) : null,
        metadata: message ? { message } : undefined,
        createdByUserId: user.id,
      },
      include: {
        template: true,
      },
    })

    await prisma.patientTask.create({
      data: {
        practiceId: user.practiceId,
        patientId,
        type: 'form_completion',
        title: `Complete ${request.template.name}`,
        description: message || 'Please complete this form at your earliest convenience.',
        status: 'pending',
        dueDate: dueDate ? new Date(dueDate) : null,
        metadata: {
          formRequestId: request.id,
          formTemplateId: request.formTemplateId,
        },
      },
    })

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
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
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      )
    }

    const portalLink = await getVerifiedFormRequestPortalUrl({
      practiceId: user.practiceId,
      patientId,
      formRequestId: request.id,
    })

    const notificationChannel = notifyChannel === 'email' || notifyChannel === 'sms' ? notifyChannel : 'none'
    let notificationResult: { status: 'sent' | 'failed' | 'skipped'; error?: string; messageId?: string } = {
      status: 'skipped',
    }

    if (notificationChannel !== 'none') {
      if (!notificationTemplateId) {
        return NextResponse.json(
          { error: 'Notification template is required when sending a notification.' },
          { status: 400 }
        )
      }

      const brandProfile = await prisma.brandProfile.findUnique({
        where: { tenantId: user.practiceId },
      })

      let portalVerifiedUrl = '#'
      try {
        const portalVerified = await getOrCreateVerifiedPatientPortalUrl({
          practiceId: user.practiceId,
          patientId,
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

      const template = await prisma.marketingTemplate.findFirst({
        where: {
          id: notificationTemplateId,
          tenantId: user.practiceId,
          channel: notificationChannel,
        },
      })

      if (!template) {
        return NextResponse.json(
          { error: 'Notification template not found' },
          { status: 404 }
        )
      }

      try {
        if (notificationChannel === 'email') {
          if (!patient.email) {
            throw new Error('Patient has no email address on file')
          }

          const sendgridClient = await getSendgridClient(user.practiceId)
          const sendgridIntegration = await prisma.sendgridIntegration.findFirst({
            where: {
              practiceId: user.practiceId,
              isActive: true,
            },
          })

          if (!sendgridIntegration) {
            throw new Error('SendGrid integration is not configured')
          }

          let html = template.bodyHtml || ''
          let text = template.bodyText || ''

          if (template.editorType === 'dragdrop' && template.bodyJson) {
            let bodyJson: any = template.bodyJson
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
          } else if (template.editorType === 'html' && template.bodyHtml) {
            html = template.bodyHtml
            text = template.bodyHtml.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')
          }

          if (!html && !text) {
            throw new Error('Email template has no content')
          }

          const subject = template.subject
            ? replaceVariables(template.subject, context)
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

          notificationResult = { status: 'sent', messageId: result.messageId }
        }

        if (notificationChannel === 'sms') {
          const phoneNumber = patient.primaryPhone || patient.phone
          if (!phoneNumber) {
            throw new Error('Patient has no phone number on file')
          }

          if (!template.bodyText) {
            throw new Error('SMS template has no message body')
          }

          const messageBody = replaceVariables(template.bodyText, context)
          const twilioClient = await getTwilioClient(user.practiceId)
          const result = await twilioClient.sendSms({
            to: phoneNumber,
            body: messageBody,
          })

          if (!result.success) {
            throw new Error(result.error || 'Failed to send SMS')
          }

          notificationResult = { status: 'sent', messageId: result.messageId }
        }
      } catch (notificationError) {
        notificationResult = {
          status: 'failed',
          error: notificationError instanceof Error ? notificationError.message : 'Failed to send notification',
        }
      }
    }

    await emitEvent({
      practiceId: user.practiceId,
      eventName: 'crm/form_request.created',
      entityType: 'form_request',
      entityId: request.id,
      data: {
        patientId,
        patient,
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

    return NextResponse.json({ request, notification: notificationResult }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create request' },
      { status: 500 }
    )
  }
}
