import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { executeTool, validateToolName } from '@/lib/healix-tools'
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

When suggesting actions:
- Only suggest low-risk operational actions
- Explain why each action is helpful
- Require explicit user confirmation before executing (unless user clicks a suggested action button)

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
      
      // Include pre-fetched patient summary if available
      if (contextPayload.patientSummary) {
        const summary = contextPayload.patientSummary
        contextParts.push(`\nPatient Summary (pre-loaded):`)
        contextParts.push(`- Name: ${summary.name || 'N/A'}`)
        contextParts.push(`- Phone: ${summary.phone || 'N/A'}`)
        contextParts.push(`- Email: ${summary.email || 'N/A'}`)
        contextParts.push(`- Preferred Contact: ${summary.preferredContactMethod || 'N/A'}`)
        if (summary.appointments && summary.appointments.length > 0) {
          contextParts.push(`- Recent Appointments: ${summary.appointments.length} found`)
          summary.appointments.slice(0, 3).forEach((apt: any) => {
            contextParts.push(`  • ${new Date(apt.startTime).toLocaleDateString()} - ${apt.visitType} (${apt.status})`)
          })
        }
        if (summary.timelineEntries && summary.timelineEntries.length > 0) {
          contextParts.push(`- Recent Timeline: ${summary.timelineEntries.length} entries`)
          summary.timelineEntries.slice(0, 5).forEach((entry: any) => {
            contextParts.push(`  • ${entry.title}${entry.description ? ': ' + entry.description.substring(0, 50) : ''}`)
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
        contextParts.push(`- Start Time: ${new Date(apt.startTime).toLocaleString()}`)
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

