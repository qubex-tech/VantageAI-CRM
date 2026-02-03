"use client"

import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleSend = () => {
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className="space-y-3">
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
