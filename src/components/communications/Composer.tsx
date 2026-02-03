"use client"

import { useRef, useState } from 'react'
import { Paperclip, Send, StickyNote } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AttachmentDraft {
  fileName: string
  mimeType?: string | null
  fileSize?: number | null
  storageKey: string
  url?: string | null
}

export function Composer({
  onSend,
  onAddNote,
  disabled,
}: {
  onSend: (body: string, attachments: AttachmentDraft[]) => void
  onAddNote: (body: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = () => {
    if (!value.trim()) return
    onSend(value.trim(), attachments)
    setValue('')
    setAttachments([])
  }

  const handleNote = () => {
    if (!value.trim()) return
    onAddNote(value.trim())
    setValue('')
  }

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {attachments.map((file) => (
            <span key={file.storageKey} className="rounded-full bg-slate-100 px-2 py-1">
              {file.fileName}
            </span>
          ))}
        </div>
      )}

      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type a message..."
        className="min-h-[96px] resize-none border-slate-200 text-sm"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setAttachments((prev) => [
                ...prev,
                {
                  fileName: file.name,
                  mimeType: file.type,
                  fileSize: file.size,
                  storageKey: `local-${Date.now()}-${file.name}`,
                },
              ])
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleNote}
            disabled={disabled}
            className={cn('gap-2')}
          >
            <StickyNote className="h-4 w-4" />
            Add note
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={disabled} className="gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
