'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react'

interface ComposeSmsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientPhone?: string
  patientName: string
  patientId?: string
}

export function ComposeSms({
  open,
  onOpenChange,
  patientPhone,
  patientName,
  patientId,
}: ComposeSmsProps) {
  const router = useRouter()
  const [to, setTo] = useState(patientPhone || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (patientPhone) {
      setTo(patientPhone)
    }
  }, [patientPhone])

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setMessage('')
        setError('')
        setSuccess('')
        setSending(false)
      }, 300)
    }
  }, [open])

  const messageStats = useMemo(() => {
    const length = message.length
    const segments = length <= 160 ? 1 : Math.ceil(length / 153)
    return { length, segments }
  }, [message])

  const isValidPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7
  }

  const handleSend = async () => {
    setError('')
    setSuccess('')

    if (!to.trim()) {
      setError('Phone number is required')
      return
    }

    if (!isValidPhone(to.trim())) {
      setError('Please enter a valid phone number')
      return
    }

    if (!message.trim()) {
      setError('Message is required')
      return
    }

    setSending(true)
    setError('')
    setSuccess('')

    let errorOccurred = false
    let errorMessage = 'Failed to send SMS. Please try again.'

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to.trim(),
          message: message.trim(),
          patientId,
        }),
      }).catch((fetchError) => {
        console.error('[ComposeSms] Fetch error:', fetchError)
        errorOccurred = true
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
        throw fetchError
      })

      if (!response) {
        errorOccurred = true
        errorMessage = 'No response from server. Please try again.'
        throw new Error(errorMessage)
      }

      let data
      try {
        const responseText = await response.text()
        if (!responseText) {
          errorOccurred = true
          errorMessage = 'Empty response from server. Please try again.'
          throw new Error(errorMessage)
        }
        data = JSON.parse(responseText)
      } catch (jsonError) {
        errorOccurred = true
        errorMessage = 'Server error: Unable to process the request. Please try again later.'
        throw jsonError
      }

      if (!response.ok) {
        errorOccurred = true
        errorMessage = data?.error || 'Failed to send SMS'
        if (
          errorMessage.includes('Twilio integration not configured') ||
          errorMessage.includes('Twilio integration not found')
        ) {
          errorMessage = 'SMS service is not configured. Please configure Twilio in Settings → Twilio SMS Integration.'
        } else if (
          errorMessage.includes('Invalid') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403')
        ) {
          errorMessage = 'Invalid SMS service configuration. Please check your Twilio credentials in Settings.'
        }
        throw new Error(errorMessage)
      }

      setError('')
      setSuccess('SMS sent successfully!')
      setSending(false)

      setTimeout(() => {
        onOpenChange(false)
        router.refresh()
      }, 2000)
      return
    } catch (err) {
      errorOccurred = true
      if (err instanceof Error && err.message) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('network')
      ) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
      }
    } finally {
      setSending(false)
      if (errorOccurred) {
        setError(errorMessage)
        setSuccess('')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Compose SMS
          </DialogTitle>
          <DialogDescription>
            Send an SMS to {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+14155551234"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full min-h-[180px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 resize-y"
              required
            />
            <div className="text-xs text-gray-500">
              {messageStats.length} characters • {messageStats.segments} segment{messageStats.segments === 1 ? '' : 's'}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border-2 border-red-300 shadow-md animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-red-900">Unable to send SMS</p>
                <p className="text-red-700 break-words">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-5 text-base text-green-800 border-2 border-green-400 shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-500 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <CheckCircle2 className="h-7 w-7 text-green-600 animate-in zoom-in-95 duration-300" />
                <div className="absolute inset-0 h-7 w-7 bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900 text-lg">{success}</p>
                <p className="text-sm text-green-700 mt-1">The SMS has been sent to {to}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSend()
            }}
            disabled={sending || !to.trim() || !message.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              'Sending...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send SMS
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
