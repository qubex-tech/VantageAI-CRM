import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware'
import { prisma } from '@/lib/db'
import { executeTool, validateToolName } from '@/lib/healix-tools'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/healix/action
 * Execute a suggested action
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!user.practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { conversationId, actionId, tool, args } = body

    if (!tool || !args) {
      // Try to get from conversation if actionId provided
      if (conversationId && actionId) {
        const conversation = await prisma.healixConversation.findFirst({
          where: {
            id: conversationId,
            practiceId: user.practiceId,
            userId: user.id,
          },
          include: {
            messages: {
              where: { role: 'assistant' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })

        if (conversation && conversation.messages.length > 0) {
          const lastMessage = conversation.messages[0]
          const content = lastMessage.content as any

          if (content.suggested_actions && Array.isArray(content.suggested_actions)) {
            const action = content.suggested_actions.find((a: any) => a.id === actionId)
            if (action) {
              // Use action's tool and args
              const toolToExecute = action.tool
              const argsToExecute = { ...action.args, clinicId: user.practiceId }

              // Validate tool name
              if (!validateToolName(toolToExecute)) {
                return NextResponse.json(
                  { error: `Invalid tool: ${toolToExecute}` },
                  { status: 400 }
                )
              }

              // Execute tool
              const result = await executeTool(toolToExecute, argsToExecute, user.id)

              // Log action
              await prisma.healixActionLog.create({
                data: {
                  conversationId: conversation.id,
                  userId: user.id,
                  practiceId: user.practiceId,
                  actionType: 'action_executed',
                  toolName: toolToExecute,
                  toolArgs: argsToExecute,
                  toolResult: result as any, // Cast to any for Prisma Json type compatibility
                },
              })

              // Add tool result message to conversation
              await prisma.healixMessage.create({
                data: {
                  conversationId: conversation.id,
                  role: 'tool',
                  content: {
                    tool: toolToExecute,
                    result: result,
                    actionId: actionId,
                  } as any, // Cast to any for Prisma Json type compatibility
                },
              })

              // Generate confirmation message using OpenAI
              let confirmationMessage = ''
              try {
                const completion = await openai.chat.completions.create({
                  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                  messages: [
                    {
                      role: 'system',
                      content: 'Generate a brief, friendly confirmation message for an action that was executed. Keep it under 20 words.',
                    },
                    {
                      role: 'user',
                      content: `Action "${action.label}" was executed with result: ${result.success ? result.message : 'Error: ' + result.message}. Generate a confirmation.`,
                    },
                  ],
                  temperature: 0.7,
                  max_tokens: 50,
                })

                confirmationMessage = completion.choices[0]?.message?.content || 'Action executed successfully.'
              } catch (error) {
                console.error('Error generating confirmation:', error)
                confirmationMessage = result.success
                  ? `Action "${action.label}" completed: ${result.message}`
                  : `Action "${action.label}" failed: ${result.message}`
              }

              return NextResponse.json({
                success: result.success,
                message: confirmationMessage,
                result: result,
              })
            }
          }
        }

        return NextResponse.json(
          { error: 'Action not found in conversation' },
          { status: 404 }
        )
      } else {
        return NextResponse.json(
          { error: 'Either (conversationId + actionId) or (tool + args) is required' },
          { status: 400 }
        )
      }
    }

    // Direct tool execution (with explicit tool + args)
    if (!validateToolName(tool)) {
      return NextResponse.json(
        { error: `Invalid tool: ${tool}` },
        { status: 400 }
      )
    }

    // Ensure clinicId is set
    const argsWithClinicId = { ...args, clinicId: args.clinicId || user.practiceId }

    // Execute tool
    const result = await executeTool(tool, argsWithClinicId, user.id)

    // Log action
    const actionLog = await prisma.healixActionLog.create({
      data: {
        conversationId: conversationId || null,
        userId: user.id,
        practiceId: user.practiceId,
        actionType: 'action_executed',
        toolName: tool,
        toolArgs: argsWithClinicId,
        toolResult: result,
      },
    })

    // Add tool result to conversation if conversationId provided
    if (conversationId) {
      await prisma.healixMessage.create({
        data: {
          conversationId: conversationId,
          role: 'tool',
          content: {
            tool: tool,
            result: result,
            actionId: actionId || null,
          },
        },
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      result: result.data,
      actionLogId: actionLog.id,
    })
  } catch (error) {
    console.error('Error in Healix action:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute action',
      },
      { status: 500 }
    )
  }
}

