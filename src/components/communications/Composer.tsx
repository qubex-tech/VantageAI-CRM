"use client"

import { useRef, useState } from 'react'
import { Check, Loader2, Paperclip } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const channels = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'secure', label: 'Secure' },
]

export function Composer({
  onSend,
  disabled,
  defaultChannel = 'sms',
  value,
  onValueChange,
}: {
  onSend: (payload: { body: string; channel: string; subject?: string }) => Promise<boolean>
  disabled: boolean
  defaultChannel?: string
  value?: string
  onValueChange?: (next: string) => void
}) {
  const [internalValue, setInternalValue] = useState('')
  const [channel, setChannel] = useState(defaultChannel)
  const [subject, setSubject] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentValue = value ?? internalValue

  const handleSend = async () => {
    if (!currentValue.trim()) return
    setIsSending(true)
    setError('')
    const success = await onSend({
      body: currentValue.trim(),
      channel,
      subject: channel === 'email' ? subject.trim() : undefined,
    })
    setIsSending(false)
    if (success) {
      setSent(true)
      setInternalValue('')
      onValueChange?.('')
      setSubject('')
      setTimeout(() => setSent(false), 1200)
    } else {
      setError('Message failed to send. Try again.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {channels.map((item) => (
          <button
            key={item.id}
            onClick={() => setChannel(item.id)}
            className={cn(
              'rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600',
              channel === item.id && 'border-slate-300 text-slate-900'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {channel === 'email' && (
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          className="h-9 text-sm"
        />
      )}
      <Textarea
        value={currentValue}
        onChange={(event) => {
          const next = event.target.value
          setInternalValue(next)
          onValueChange?.(next)
        }}
        placeholder="Type a reply…"
        className="min-h-[96px] resize-none border-slate-200 text-sm"
      />
      {error ? <div className="text-xs text-rose-500">{error}</div> : null}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach
        </button>
        <input ref={fileInputRef} type="file" className="hidden" />
        <Button size="sm" onClick={handleSend} disabled={disabled || !currentValue.trim() || isSending}>
          {isSending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending
            </span>
          ) : sent ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Sent
            </span>
          ) : (
            'Send'
          )}
        </Button>
      </div>
    </div>
  )
}
