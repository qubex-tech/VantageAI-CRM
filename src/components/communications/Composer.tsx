"use client"

import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
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
}: {
  onSend: (payload: { body: string; channel: string; subject?: string }) => void
  disabled: boolean
  defaultChannel?: string
}) {
  const [value, setValue] = useState('')
  const [channel, setChannel] = useState(defaultChannel)
  const [subject, setSubject] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleSend = () => {
    if (!value.trim()) return
    onSend({
      body: value.trim(),
      channel,
      subject: channel === 'email' ? subject.trim() : undefined,
    })
    setValue('')
    setSubject('')
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
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type a reply…"
        className="min-h-[96px] resize-none border-slate-200 text-sm"
      />
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
        <Button size="sm" disabled={disabled || !value.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
