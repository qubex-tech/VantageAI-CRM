'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { X, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHealixContext, type HealixContextPayload } from '@/hooks/useHealixContext'
import { parseHealixResponse, formatMarkdown } from '@/lib/healix-formatter'

export interface HealixMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: Date
}

export interface SuggestedAction {
  id: string
  label: string
  risk: 'low' | 'medium' | 'high'
  tool: string
  args: any
  why: string
}

interface HealixDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: HealixContextPayload
}

export function HealixDrawer({ open, onOpenChange, context }: HealixDrawerProps) {
  const [messages, setMessages] = useState<HealixMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  // Focus input when drawer opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Keyboard shortcut: Cmd/Ctrl+K to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (!open) {
          onOpenChange(true)
        } else if (inputRef.current) {
          inputRef.current.focus()
        }
      }
      // Escape to close
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: HealixMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setCurrentResponse('')
    setSuggestedActions([])

    try {
      const response = await fetch('/api/healix/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userMessage: messageText,
          contextPayload: context,
        }),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          // If response isn't JSON, get text
          const text = await response.text()
          throw new Error(text || `HTTP ${response.status}: Failed to send message`)
        }
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to send message`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      let fullAnswer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonStr = line.trim().slice(6) // Remove 'data: ' prefix
              if (!jsonStr) continue
              
              const data = JSON.parse(jsonStr)

              if (data.type === 'token') {
                fullAnswer += data.content
                // While streaming, show the answer portion if it's JSON
                try {
                  const partialParsed = parseHealixResponse(fullAnswer)
                  setCurrentResponse(partialParsed.answer || fullAnswer)
                } catch {
                  setCurrentResponse(fullAnswer)
                }
              } else if (data.type === 'conversation_id') {
                // Store conversation ID from API response
                if (!conversationId) {
                  setConversationId(data.id)
                }
              } else if (data.type === 'suggested_actions') {
                setSuggestedActions(data.actions || [])
              } else if (data.type === 'done') {
                // Parse and format the final response
                if (fullAnswer) {
                  const parsed = parseHealixResponse(fullAnswer)
                  // Format the answer nicely (extract just the answer text)
                  const formattedAnswer = parsed.answer || fullAnswer
                  
                  // Update suggested actions if they're in the parsed response
                  if (parsed.suggestedActions.length > 0 && suggestedActions.length === 0) {
                    setSuggestedActions(parsed.suggestedActions)
                  }

                  const assistantMessage: HealixMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: formattedAnswer, // Store formatted answer, not raw JSON
                    timestamp: new Date(),
                  }
                  setMessages((prev) => [...prev, assistantMessage])
                  setCurrentResponse('')
                }
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error')
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, line)
              // Continue processing other lines
            }
          }
        }
      }

      // Conversation ID is set when first message is sent (API creates conversation and returns it)
      // We'll manage it client-side by storing it after first successful message
      if (!conversationId && fullAnswer) {
        // Extract conversation ID from response if available
        // For now, we'll need to track it differently - API creates it on first message
        // In production, you might want to return it in the SSE stream or in a header
      }
    } catch (error) {
      console.error('Error sending message:', error)
      let errorText = 'Failed to send message'
      
      if (error instanceof Error) {
        errorText = error.message
        // Provide helpful error messages for common issues
        if (error.message.includes('tables not found') || error.message.includes('migrate')) {
          errorText = 'Database tables not found. Please run: npx prisma migrate deploy'
        } else if (error.message.includes('OPENAI_API_KEY')) {
          errorText = 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env'
        }
      }
      
      const errorMessage: HealixMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${errorText}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setCurrentResponse('')
    }
  }, [conversationId, context, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage(input.trim())
    }
  }

  const executeAction = useCallback(async (action: SuggestedAction) => {
    try {
      const response = await fetch('/api/healix/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          actionId: action.id,
          tool: action.tool,
          args: { ...action.args, clinicId: context.patientId ? undefined : undefined }, // Will be set by API
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to execute action')
      }

      const result = await response.json()

      // Add tool result message
      const toolMessage: HealixMessage = {
        id: Date.now().toString(),
        role: 'tool',
        content: result.message || 'Action executed',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, toolMessage])

      // Refresh suggested actions (remove executed one)
      setSuggestedActions((prev) => prev.filter((a) => a.id !== action.id))
    } catch (error) {
      console.error('Error executing action:', error)
      const errorMessage: HealixMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error executing action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }, [conversationId, context])

  // Render context chips
  const contextChips = []
  if (context.patientId) {
    contextChips.push({ label: 'Patient', value: context.patientId.slice(0, 8) })
  }
  if (context.appointmentId) {
    contextChips.push({ label: 'Appointment', value: context.appointmentId.slice(0, 8) })
  }
  if (context.invoiceId) {
    contextChips.push({ label: 'Invoice', value: context.invoiceId.slice(0, 8) })
  }
  if (context.screenTitle) {
    contextChips.push({ label: 'Screen', value: context.screenTitle })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[600px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gray-900" />
            <SheetTitle>Healix Assistant</SheetTitle>
          </div>
          <SheetDescription className="text-left">
            Ask me anything about operations, or I can help with tasks and notes.
          </SheetDescription>
        </SheetHeader>

        {/* Context Chips */}
        {contextChips.length > 0 && (
          <div className="px-6 py-3 border-b bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {contextChips.map((chip, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white border border-gray-200 rounded-md"
                >
                  <span className="text-gray-500">{chip.label}:</span>
                  <span className="text-gray-900">{chip.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 text-sm py-8">
              <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>Start a conversation with Healix</p>
              <p className="text-xs mt-1">Press Cmd/Ctrl+K to focus</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-gray-900 text-white'
                    : message.role === 'tool'
                    ? 'bg-blue-50 text-blue-900 border border-blue-200'
                    : 'bg-gray-100 text-gray-900'
                )}
              >
                {message.role === 'assistant' ? (
                  <div 
                    className="text-sm break-words prose prose-sm max-w-none"
                    style={{ 
                      lineHeight: '1.6',
                      wordBreak: 'break-word'
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: formatMarkdown(message.content)
                    }}
                  />
                ) : (
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
                <div
                  className={cn(
                    'text-xs mt-1',
                    message.role === 'user' ? 'text-gray-300' : 'text-gray-500'
                  )}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {currentResponse && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                <div 
                  className="text-sm break-words prose prose-sm max-w-none"
                  style={{ 
                    lineHeight: '1.6',
                    wordBreak: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: formatMarkdown(parseHealixResponse(currentResponse).answer || currentResponse) + '<span class="inline-block w-2 h-4 bg-gray-900 animate-pulse ml-1"></span>'
                  }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggested Actions</h3>
            <div className="space-y-2">
              {suggestedActions.map((action) => (
                <Card key={action.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{action.label}</div>
                      {action.why && (
                        <div className="text-xs text-gray-500 mt-1">{action.why}</div>
                      )}
                      {action.risk !== 'low' && (
                        <div className="text-xs text-amber-600 mt-1">
                          Risk: {action.risk}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeAction(action)}
                      disabled={action.risk !== 'low'}
                    >
                      Execute
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-6 py-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Healix anything..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

