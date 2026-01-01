'use client'

import { useState, useEffect } from 'react'
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
import { Mail, Send, X, CheckCircle2 } from 'lucide-react'

interface ComposeEmailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientEmail?: string
  patientName: string
}

export function ComposeEmail({
  open,
  onOpenChange,
  patientEmail,
  patientName,
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
      setSubject('')
      setBody('')
      setError('')
      setSuccess('')
      // Keep the email address even when dialog closes
    }
  }, [open])

  const handleSend = async () => {
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

    setError('')
    setSuccess('')
    setSending(true)

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      // Show success message
      setSuccess('Email sent successfully!')
      setSending(false)
      
      // Close dialog after showing success animation
      setTimeout(() => {
        onOpenChange(false)
        // Reset form after dialog closes
        setSubject('')
        setBody('')
        setError('')
        setSuccess('')
        setTo(patientEmail || '')
      }, 2000)
    } catch (err) {
      console.error('Error sending email:', err)
      setError(err instanceof Error ? err.message : 'Failed to send email')
      setSending(false)
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
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-gradient-to-r from-green-50 to-emerald-50 p-4 text-sm text-green-800 border-2 border-green-300 shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-500 flex items-center gap-3">
              <div className="relative">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 animate-in zoom-in-95 duration-300" />
                <div className="absolute inset-0 h-6 w-6 bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="font-semibold">{success}</span>
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
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
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

