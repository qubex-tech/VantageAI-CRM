import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { executeTool, validateToolName } from '@/lib/healix-tools'
import { formatHealixActionCatalog } from '@/lib/healix-action-catalog'
import { formatDateOnly, formatDateTime, resolveLocale, resolveTimeZone } from '@/lib/timezone'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

/**
 * System prompt for Healix assistant
 */
const HEALIX_SYSTEM_PROMPT = `You are Healix, an AI assistant for medical practice CRM systems. Your role is to provide operational support only.

CRITICAL RULES:
1. NEVER provide clinical advice, diagnosis, or treatment recommendations
2. NEVER suggest medications, procedures, or medical interventions
3. If asked about clinical matters, respond: "I can only help with operational tasks. Please consult a healthcare provider for medical advice."
4. Always acknowledge when you don't have enough data to answer
5. Be concise and helpful with operational questions

You have access to the following tools:
- createTask: Create internal tasks
- createNote: Create notes for patients or appointments
- draftMessage: Draft SMS or email messages
- updatePatientFields: Update non-sensitive patient fields (preferredName, contactPreferences, language, marketingOptIn)
- searchPatients: Search for patients
- getPatientSummary: Get detailed patient information
- getAppointmentSummary: Get appointment details
- sendPortalInvite: Send secure portal invites (email/SMS)
- listFormTemplates: List available patient form templates
- requestFormCompletion: Create a form request and optionally notify the patient
- sendSms: Send a direct SMS to a patient (if configured)

Action catalog (available actions and whether they are executable):
${formatHealixActionCatalog()}

When suggesting actions:
- Only suggest low-risk operational actions
- Explain why each action is helpful
- Require explicit user confirmation before executing (unless user clicks a suggested action button)
- If the user asks to SEND a message, suggest sendSms (not draftMessage)
- Only suggest draftMessage when the user explicitly asks for a draft
- If the user asks to send a form (intake/insurance/updates), suggest listFormTemplates then requestFormCompletion
- When suggesting sendSms, include patientId if known; otherwise include patientName

Format your response as JSON with this structure:
{
  "answer": "Your response in markdown",
  "assumptions": ["assumption1", "assumption2"],
  "questions": ["question1", "question2"],
  "suggested_actions": [
    {
      "id": "unique-id",
      "label": "Action label",
      "risk": "low",
      "tool": "toolName",
      "args": {...},
      "why": "Why this action is helpful"
    }
  ]
}`

/**
 * POST /api/healix/chat
 * Chat endpoint with streaming support
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return new Response(
        JSON.stringify({ error: 'Practice ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const body = await req.json()
    const { conversationId, userMessage, contextPayload } = body
    const timeZone = await resolveTimeZone(req.headers, contextPayload?.timeZone)
    const locale = resolveLocale(req.headers, contextPayload?.locale)

    if (!userMessage || typeof userMessage !== 'string') {
      return new Response(
        JSON.stringify({ error: 'userMessage is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      conversation = await prisma.healixConversation.findFirst({
        where: {
          id: conversationId,
          practiceId: user.practiceId,
          userId: user.id,
        },
      })

      if (!conversation) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    } else {
      try {
        conversation = await prisma.healixConversation.create({
          data: {
            practiceId: user.practiceId,
            userId: user.id,
          },
        })
      } catch (error: any) {
        // If table doesn't exist, provide helpful error
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
          console.error('Healix tables not found. Please run migration:', error)
          return new Response(
            JSON.stringify({ 
              error: 'Healix database tables not found. Please run: npx prisma migrate deploy' 
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
        throw error
      }
    }

    // Get conversation history
    const messages = await prisma.healixMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 50, // Limit to recent messages
    })

    // Build context string from contextPayload
    let contextString = ''
    if (contextPayload) {
      const contextParts: string[] = []
      const formatAge = (dob?: string) => {
        if (!dob) return null
        const birthDate = new Date(dob)
        if (Number.isNaN(birthDate.getTime())) return null
        const now = new Date()
        let age = now.getFullYear() - birthDate.getFullYear()
        const monthDiff = now.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
          age -= 1
        }
        return age
      }

      const patientQuery = extractPatientQuery(userMessage)
      if (patientQuery) {
        const searchResult = await executeTool(
          'searchPatients',
          { clinicId: user.practiceId, query: patientQuery },
          user.id
        )
        if (searchResult.success && Array.isArray(searchResult.data?.patients)) {
          const candidates = searchResult.data.patients.slice(0, 5)
          if (candidates.length > 0) {
            contextParts.push(`\nPatient lookup results for "${patientQuery}":`)
            candidates.forEach((patient: any) => {
              contextParts.push(`- ${patient.name} (${patient.id})`)
            })
          }
          if (candidates.length === 1) {
            const candidate = candidates[0]
            const summaryResult = await executeTool(
              'getPatientSummary',
              { clinicId: user.practiceId, patientId: candidate.id },
              user.id
            )
            if (summaryResult.success && summaryResult.data) {
              const summary = summaryResult.data
              contextParts.push(`\nPatient Summary (lookup):`)
              contextParts.push(`- Name: ${summary.name || 'N/A'}`)
              if (summary.dateOfBirth) {
                const age = formatAge(summary.dateOfBirth)
                const dobLabel = formatDateOnly(summary.dateOfBirth, { timeZone, locale })
                contextParts.push(`- DOB: ${dobLabel}${typeof age === 'number' ? ` (age ${age})` : ''}`)
              }
              contextParts.push(`- Phone: ${summary.phone || 'N/A'}`)
              contextParts.push(`- Email: ${summary.email || 'N/A'}`)
              contextParts.push(`- Preferred Contact: ${summary.preferredContactMethod || 'N/A'}`)
              if (summary.recentAppointments && summary.recentAppointments.length > 0) {
                contextParts.push(`- Recent Appointments: ${summary.recentAppointments.length} found`)
                summary.recentAppointments.slice(0, 3).forEach((apt: any) => {
                  const formattedStart = formatDateTime(apt.startTime, { timeZone, locale })
                  contextParts.push(`  • ${formattedStart} - ${apt.visitType} (${apt.status})`)
                })
              }
              if (summary.recentTimelineEntries && summary.recentTimelineEntries.length > 0) {
                contextParts.push(`- Recent Timeline: ${summary.recentTimelineEntries.length} entries`)
                summary.recentTimelineEntries.slice(0, 5).forEach((entry: any) => {
                  const entryDate = entry.createdAt ? formatDateOnly(entry.createdAt, { timeZone, locale }) : null
                  const label = entryDate ? `${entryDate} — ${entry.title}` : entry.title
                  contextParts.push(`  • ${label}${entry.description ? ': ' + entry.description.substring(0, 50) : ''}`)
                })
              }
            }
          }
        }
      }
      if (contextPayload.route) {
        contextParts.push(`Current page: ${contextPayload.route}`)
      }
      if (contextPayload.screenTitle) {
        contextParts.push(`Screen: ${contextPayload.screenTitle}`)
      }
      if (contextPayload.patientId) {
        contextParts.push(`Viewing patient ID: ${contextPayload.patientId}`)
      }
      if (contextPayload.appointmentId) {
        contextParts.push(`Viewing appointment ID: ${contextPayload.appointmentId}`)
      }
      if (contextPayload.invoiceId) {
        contextParts.push(`Viewing invoice ID: ${contextPayload.invoiceId}`)
      }
      if (timeZone) {
        contextParts.push(`User time zone: ${timeZone}`)
      }
      
      // Include pre-fetched patient summary if available
      if (contextPayload.patientSummary) {
        const summary = contextPayload.patientSummary
        contextParts.push(`\nPatient Summary (pre-loaded):`)
        contextParts.push(`- Name: ${summary.name || 'N/A'}`)
        if (summary.dateOfBirth) {
          const age = formatAge(summary.dateOfBirth)
          const dobLabel = formatDateOnly(summary.dateOfBirth, { timeZone, locale })
          contextParts.push(`- DOB: ${dobLabel}${typeof age === 'number' ? ` (age ${age})` : ''}`)
        }
        if (summary.gender) {
          contextParts.push(`- Gender: ${summary.gender}`)
        }
        if (summary.pronouns) {
          contextParts.push(`- Pronouns: ${summary.pronouns}`)
        }
        if (summary.primaryLanguage) {
          contextParts.push(`- Language: ${summary.primaryLanguage}`)
        }
        contextParts.push(`- Phone: ${summary.phone || 'N/A'}`)
        contextParts.push(`- Email: ${summary.email || 'N/A'}`)
        contextParts.push(`- Preferred Contact: ${summary.preferredContactMethod || 'N/A'}`)
        if (summary.preferredChannel) {
          contextParts.push(`- Preferred Channel: ${summary.preferredChannel}`)
        }
        if (summary.doNotContact !== undefined) {
          contextParts.push(`- Do Not Contact: ${summary.doNotContact ? 'Yes' : 'No'}`)
        }
        if (summary.smsOptIn !== undefined || summary.emailOptIn !== undefined || summary.voiceOptIn !== undefined) {
          contextParts.push(`- Consent: SMS ${summary.smsOptIn ? 'opted in' : 'no'} / Email ${summary.emailOptIn ? 'opted in' : 'no'} / Voice ${summary.voiceOptIn ? 'opted in' : 'no'}`)
        }
        if (summary.addressLine1 || summary.city || summary.state || summary.postalCode) {
          const address = [summary.addressLine1, summary.addressLine2, summary.city, summary.state, summary.postalCode]
            .filter(Boolean)
            .join(', ')
          contextParts.push(`- Address: ${address}`)
        }
        if (summary.insuranceStatus) {
          contextParts.push(`- Insurance Status: ${summary.insuranceStatus}`)
        }
        if (summary.lastInsuranceVerifiedAt) {
          const verifiedAt = formatDateOnly(summary.lastInsuranceVerifiedAt, { timeZone, locale })
          contextParts.push(`- Insurance Verified: ${verifiedAt}`)
        }
        if (summary.notes) {
          contextParts.push(`- Notes: ${summary.notes}`)
        }
        const recentAppointments = summary.recentAppointments || summary.appointments
        if (recentAppointments && recentAppointments.length > 0) {
          contextParts.push(`- Recent Appointments: ${recentAppointments.length} found`)
          recentAppointments.slice(0, 3).forEach((apt: any) => {
            const formattedStart = formatDateTime(apt.startTime, { timeZone, locale })
            contextParts.push(`  • ${formattedStart} - ${apt.visitType} (${apt.status})`)
          })
        }
        if (summary.patientNotes && summary.patientNotes.length > 0) {
          contextParts.push(`- Recent Patient Notes: ${summary.patientNotes.length} found`)
          summary.patientNotes.slice(0, 5).forEach((note: any) => {
            const notedAt = note.createdAt ? formatDateOnly(note.createdAt, { timeZone, locale }) : 'Unknown date'
            contextParts.push(`  • ${notedAt} [${note.type || 'note'}] ${note.content?.substring(0, 80) || ''}`)
          })
        }
        if (summary.timelineEntries && summary.timelineEntries.length > 0) {
          contextParts.push(`- Recent Timeline: ${summary.timelineEntries.length} entries`)
          summary.timelineEntries.slice(0, 5).forEach((entry: any) => {
            const entryDate = entry.createdAt ? formatDateOnly(entry.createdAt, { timeZone, locale }) : null
            const label = entryDate ? `${entryDate} — ${entry.title}` : entry.title
            contextParts.push(`  • ${label}${entry.description ? ': ' + entry.description.substring(0, 50) : ''}`)
          })
        }
        if (summary._count) {
          contextParts.push(`- Total Appointments: ${summary._count.appointments || 0}`)
          contextParts.push(`- Total Timeline Entries: ${summary._count.timelineEntries || 0}`)
        }
      }
      
      // Include pre-fetched appointment summary if available
      if (contextPayload.appointmentSummary) {
        const apt = contextPayload.appointmentSummary
        contextParts.push(`\nAppointment Summary (pre-loaded):`)
        contextParts.push(`- Status: ${apt.status || 'N/A'}`)
        contextParts.push(`- Start Time: ${formatDateTime(apt.startTime, { timeZone, locale })}`)
        contextParts.push(`- Visit Type: ${apt.visitType || 'N/A'}`)
        if (apt.patient) {
          contextParts.push(`- Patient: ${apt.patient.name || 'N/A'} (${apt.patient.phone || 'N/A'})`)
        }
        if (apt.reason) {
          contextParts.push(`- Reason: ${apt.reason}`)
        }
        if (apt.notes) {
          contextParts.push(`- Notes: ${apt.notes}`)
        }
      }

      // Include dashboard context if available (rolling 14-day window)
      if (contextPayload.dashboardContext) {
        const dashboard = contextPayload.dashboardContext as {
          windowStart?: string
          windowEnd?: string
          recentPatients?: Array<{ name: string; lastSeenAt?: string; dateOfBirth?: string }>
          upcomingPatients?: Array<{ name: string; nextVisitAt?: string; dateOfBirth?: string }>
          recentAppointments?: Array<{ id: string; patientName?: string; startTime?: string; status?: string; visitType?: string | null }>
          upcomingAppointments?: Array<{ id: string; patientName?: string; startTime?: string; status?: string; visitType?: string | null }>
          recentNotes?: Array<{ patientName: string; type: string }>
          recentTimeline?: Array<{ patientName?: string; type: string; title: string; createdAt?: string }>
        }
        contextParts.push(`\nDashboard Context (Rolling 14 Days):`)
        if (dashboard.windowStart && dashboard.windowEnd) {
          contextParts.push(`- Window: ${formatDateOnly(dashboard.windowStart, { timeZone, locale })} to ${formatDateOnly(dashboard.windowEnd, { timeZone, locale })}`)
        }

        if (dashboard.recentPatients && dashboard.recentPatients.length > 0) {
          contextParts.push(`- Recent patients (last 7 days): ${dashboard.recentPatients.length}`)
          dashboard.recentPatients.slice(0, 5).forEach((patient: { name: string; lastSeenAt?: string; dateOfBirth?: string }) => {
            const age = formatAge(patient.dateOfBirth)
            const lastSeen = patient.lastSeenAt
              ? formatDateOnly(patient.lastSeenAt, { timeZone, locale })
              : null
            contextParts.push(`  • ${patient.name}${typeof age === 'number' ? ` (age ${age})` : ''}${lastSeen ? ` (last seen ${lastSeen})` : ''}`)
          })
        }
        if (dashboard.upcomingPatients && dashboard.upcomingPatients.length > 0) {
          contextParts.push(`- Upcoming patients (next 7 days): ${dashboard.upcomingPatients.length}`)
          dashboard.upcomingPatients.slice(0, 5).forEach((patient: { name: string; nextVisitAt?: string; dateOfBirth?: string }) => {
            const age = formatAge(patient.dateOfBirth)
            const nextVisit = patient.nextVisitAt
              ? formatDateOnly(patient.nextVisitAt, { timeZone, locale })
              : null
            contextParts.push(`  • ${patient.name}${typeof age === 'number' ? ` (age ${age})` : ''}${nextVisit ? ` (next visit ${nextVisit})` : ''}`)
          })
        }
        if (dashboard.recentAppointments && dashboard.recentAppointments.length > 0) {
          contextParts.push(`- Recent appointments: ${dashboard.recentAppointments.length}`)
          dashboard.recentAppointments.slice(0, 5).forEach((apt: { patientName?: string; startTime?: string; status?: string; visitType?: string | null }) => {
            if (!apt.startTime) return
            const formattedStart = formatDateTime(apt.startTime, { timeZone, locale })
            contextParts.push(`  • ${apt.patientName || 'Patient'} — ${formattedStart}${apt.visitType ? ` (${apt.visitType})` : ''}${apt.status ? ` [${apt.status}]` : ''}`)
          })
        }
        if (dashboard.upcomingAppointments && dashboard.upcomingAppointments.length > 0) {
          contextParts.push(`- Upcoming appointments: ${dashboard.upcomingAppointments.length}`)
          dashboard.upcomingAppointments.slice(0, 5).forEach((apt: { patientName?: string; startTime?: string; status?: string; visitType?: string | null }) => {
            if (!apt.startTime) return
            const formattedStart = formatDateTime(apt.startTime, { timeZone, locale })
            contextParts.push(`  • ${apt.patientName || 'Patient'} — ${formattedStart}${apt.visitType ? ` (${apt.visitType})` : ''}${apt.status ? ` [${apt.status}]` : ''}`)
          })
        }
        if (dashboard.recentNotes && dashboard.recentNotes.length > 0) {
          contextParts.push(`- Recent notes: ${dashboard.recentNotes.length}`)
          dashboard.recentNotes.slice(0, 3).forEach((note: { patientName: string; type: string }) => {
            contextParts.push(`  • ${note.patientName} (${note.type})`)
          })
        }
        if (dashboard.recentTimeline && dashboard.recentTimeline.length > 0) {
          contextParts.push(`- Recent communications: ${dashboard.recentTimeline.length}`)
          dashboard.recentTimeline
            .filter((entry: { type: string }) => ['email', 'sms', 'call', 'voice', 'reminder'].includes(entry.type))
            .slice(0, 5)
            .forEach((entry: { patientName?: string; type: string; title: string; createdAt?: string }) => {
              const entryDate = entry.createdAt ? formatDateOnly(entry.createdAt, { timeZone, locale }) : 'Unknown date'
              contextParts.push(`  • ${entryDate} — ${entry.patientName || 'Patient'} (${entry.type}): ${entry.title}`)
            })
        }
      }
      
      if (contextPayload.visibleFields && Object.keys(contextPayload.visibleFields).length > 0) {
        contextParts.push(`\nVisible page fields: ${JSON.stringify(contextPayload.visibleFields)}`)
      }
      if (contextPayload.timelineEvents && contextPayload.timelineEvents.length > 0 && !contextPayload.patientSummary) {
        contextParts.push(`\nRecent timeline events (${contextPayload.timelineEvents.length}):`)
        contextPayload.timelineEvents.slice(0, 10).forEach((event: any) => {
          contextParts.push(`- ${event.title}${event.description ? ': ' + event.description.substring(0, 50) : ''}`)
        })
      }
      contextString = contextParts.join('\n')
    }

    // Build messages array for OpenAI
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: HEALIX_SYSTEM_PROMPT },
    ]

    // Add context if available
    if (contextString) {
      openaiMessages.push({
        role: 'system',
        content: `Current page context:\n${contextString}`,
      })
    }

    // Add conversation history
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (msg.role === 'user' || msg.role === 'assistant') {
        openaiMessages.push({
          role: msg.role,
          content: content,
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      } else if (msg.role === 'tool') {
        // Tool messages formatted differently
        openaiMessages.push({
          role: 'assistant',
          content: `[Tool result]: ${content}`,
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      }
    }

    // Add current user message
    openaiMessages.push({
      role: 'user',
      content: userMessage,
    })

    // Save user message
    await prisma.healixMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: { text: userMessage },
      },
    })

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
            const openai = getOpenAIClient()
            const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: openaiMessages,
            temperature: 0.7,
            stream: true,
            response_format: { type: 'json_object' },
          })

          let fullResponse = ''
          let parsedResponse: any = null

          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullResponse += content
              // Send chunk to client
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ type: 'token', content })}\n\n`)
              )
            }
          }

          // Parse JSON response
          try {
            parsedResponse = JSON.parse(fullResponse)
          } catch (e) {
            // Fallback if JSON parsing fails
            parsedResponse = {
              answer: fullResponse,
              assumptions: [],
              questions: [],
              suggested_actions: [],
            }
          }

          // Save assistant message
          await prisma.healixMessage.create({
            data: {
              conversationId: conversation.id,
              role: 'assistant',
              content: parsedResponse,
            },
          })

          // Send suggested actions
          if (parsedResponse.suggested_actions && parsedResponse.suggested_actions.length > 0) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'suggested_actions', actions: parsedResponse.suggested_actions })}\n\n`
              )
            )
          }

          // Send conversation ID if it's a new conversation
          if (!body.conversationId) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'conversation_id', id: conversation.id })}\n\n`
              )
            )
          }

          // Send done signal
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          )

          // Update conversation timestamp
          await prisma.healixConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          })

          controller.close()
        } catch (error) {
          console.error('Error in Healix chat stream:', error)
          const errorMessage = error instanceof Error 
            ? error.message 
            : String(error)
          
          // Log full error for debugging
          console.error('Full error details:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
          })
          
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in Healix chat:', error)
    
    let errorMessage = 'Failed to process chat request'
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Provide helpful error messages
      if (error.message.includes('P2021') || error.message.includes('does not exist')) {
        errorMessage = 'Database tables not found. Please run: npx prisma migrate deploy'
      } else if (error.message.includes('OPENAI_API_KEY') || !process.env.OPENAI_API_KEY) {
        errorMessage = 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env'
      }
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

function extractPatientQuery(message: string): string | null {
  if (!message) return null
  const normalized = message.trim()
  const patterns = [
    /tell me more about\s+(.+)$/i,
    /who is\s+(.+)$/i,
    /details on\s+(.+)$/i,
    /info(?:rmation)? on\s+(.+)$/i,
    /summary of\s+(.+)$/i,
    /customer\s+(.+)$/i,
    /patient\s+(.+)$/i,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const query = match[1].replace(/[?.!]+$/, '').trim()
      if (query.length >= 2) return query
    }
  }
  return null
}

