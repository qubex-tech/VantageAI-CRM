'use client'

import React, { useState, useEffect } from 'react'
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
import { Mail, Send, X, CheckCircle2, AlertCircle } from 'lucide-react'

interface ComposeEmailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientEmail?: string
  patientName: string
  patientId?: string
}

export function ComposeEmail({
  open,
  onOpenChange,
  patientEmail,
  patientName,
  patientId,
}: ComposeEmailProps) {
  const [to, setTo] = useState(patientEmail || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Update "to" field when patientEmail prop changes
  useEffect(() => {
    if (patientEmail) {
      setTo(patientEmail)
    }
  }, [patientEmail])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Reset after a short delay to allow animations to complete
      setTimeout(() => {
        setSubject('')
        setBody('')
        setError('')
        setSuccess('')
        setSending(false)
        // Keep the email address even when dialog closes
      }, 300)
    }
  }, [open])

  const handleSend = async () => {
    // Clear previous messages
    setError('')
    setSuccess('')
    
    // Validation
    if (!to.trim()) {
      setError('Email address is required')
      return
    }

    if (!subject.trim()) {
      setError('Subject is required')
      return
    }

    if (!body.trim()) {
      setError('Email body is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to.trim())) {
      setError('Please enter a valid email address')
      return
    }

    // Start sending
    setSending(true)
    setError('')
    setSuccess('')

    let errorOccurred = false
    let errorMessage = 'Failed to send email. Please try again.'

    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to.trim(),
          toName: patientName,
          subject: subject.trim(),
          htmlContent: body.trim().replace(/\n/g, '<br>'),
          textContent: body.trim(),
          patientId: patientId,
        }),
      }).catch((fetchError) => {
        // Network error
        console.error('[ComposeEmail] Fetch error:', fetchError)
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
        errorMessage = data?.error || 'Failed to send email'
        
        // Make error messages more user-friendly
        if (errorMessage.includes('SendGrid integration not configured') || 
            errorMessage.includes('SendGrid integration not found')) {
          errorMessage = 'Email service is not configured. Please configure SendGrid in Settings → SendGrid Integration.'
        } else if (errorMessage.includes('Invalid API key') || 
                   errorMessage.includes('Unauthorized') ||
                   errorMessage.includes('401') ||
                   errorMessage.includes('403')) {
          errorMessage = 'Invalid email service configuration. Please check your SendGrid API key in Settings.'
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.'
        }
        
        throw new Error(errorMessage)
      }

      // If we got here, response is ok, so it's a success
      // (We don't need to check data.success since response.ok is enough)

      // SUCCESS - Show success message and close dialog
      setError('') // Clear any previous errors
      setSuccess('Email sent successfully!')
      setSending(false)
      
      // Close dialog after showing success animation (3 seconds to let user see the success message)
      setTimeout(() => {
        onOpenChange(false)
      }, 3000)
      
      return // Exit early on success
      
    } catch (err) {
      errorOccurred = true
      
      // Determine error message
      if (err instanceof Error && err.message) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      // Handle specific error cases
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || 
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('network')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
      }
    } finally {
      // Always reset sending state
      setSending(false)
      
      // Always show error if one occurred
      if (errorOccurred) {
        setError(errorMessage)
        setSuccess('') // Clear success if there was an error
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose email
          </DialogTitle>
          <DialogDescription>
            Send an email to {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              value="Your Practice Email"
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              Configured in Settings → SendGrid Integration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="patient@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start typing your email..."
              className="w-full min-h-[300px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 resize-y"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border-2 border-red-300 shadow-md animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-red-900">Unable to send email</p>
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
                <p className="text-sm text-green-700 mt-1">The email has been sent to {to}</p>
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
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              'Sending...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

