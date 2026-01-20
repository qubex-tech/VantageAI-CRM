'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { HealixPanel } from './HealixPanel'
import { useHealixContext, type HealixContextPayload } from '@/hooks/useHealixContext'

export interface HealixButtonProps {
  patientId?: string
  appointmentId?: string
  invoiceId?: string
  screenTitle?: string
  visibleFields?: Record<string, any>
}

// Global state to track if Healix is open (for layout adjustments)
let healixOpenState = false
const listeners = new Set<() => void>()

export function setHealixOpen(open: boolean) {
  healixOpenState = open
  listeners.forEach(listener => listener())
}

export function useHealixOpen() {
  const [open, setOpen] = useState(healixOpenState)
  
  useEffect(() => {
    const listener = () => setOpen(healixOpenState)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  
  return open
}

// Global state to control panel open/close
let healixPanelOpenState = false
const panelListeners = new Set<() => void>()

export function setHealixPanelOpen(open: boolean) {
  healixPanelOpenState = open
  panelListeners.forEach(listener => listener())
}

export function useHealixPanelOpen() {
  const [open, setOpen] = useState(healixPanelOpenState)

  useEffect(() => {
    const listener = () => setOpen(healixPanelOpenState)
    panelListeners.add(listener)
    return () => {
      panelListeners.delete(listener)
    }
  }, [])

  return open
}

// Global state for pending prompt (e.g. dashboard command center)
let healixPendingPrompt: string | null = null
const pendingPromptListeners = new Set<() => void>()

export function setHealixPendingPrompt(prompt: string | null) {
  healixPendingPrompt = prompt
  pendingPromptListeners.forEach(listener => listener())
}

export function useHealixPendingPrompt() {
  const [prompt, setPrompt] = useState(healixPendingPrompt)

  useEffect(() => {
    const listener = () => setPrompt(healixPendingPrompt)
    pendingPromptListeners.add(listener)
    return () => {
      pendingPromptListeners.delete(listener)
    }
  }, [])

  return prompt
}

// Global override for Healix context (e.g. dashboard 14-day window)
let healixContextOverride: HealixContextPayload | null = null
const contextOverrideListeners = new Set<() => void>()

export function setHealixContextOverride(context: HealixContextPayload | null) {
  healixContextOverride = context
  contextOverrideListeners.forEach(listener => listener())
}

export function useHealixContextOverride() {
  const [context, setContext] = useState(healixContextOverride)

  useEffect(() => {
    const listener = () => setContext(healixContextOverride)
    contextOverrideListeners.add(listener)
    return () => {
      contextOverrideListeners.delete(listener)
    }
  }, [])

  return context
}

export function HealixButton({
  patientId,
  appointmentId,
  invoiceId,
  screenTitle,
  visibleFields,
}: HealixButtonProps) {
  const open = useHealixPanelOpen()
  const contextOverride = useHealixContextOverride()
  const pendingPrompt = useHealixPendingPrompt()
  const { context } = useHealixContext({
    patientId,
    appointmentId,
    invoiceId,
    screenTitle,
    visibleFields,
  })

  useEffect(() => {
    setHealixOpen(open)
  }, [open])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setHealixPanelOpen(!open)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Healix</span>
      </Button>
      <HealixPanel
        open={open}
        onOpenChange={setHealixPanelOpen}
        context={contextOverride ?? context}
        initialPrompt={pendingPrompt ?? undefined}
        onInitialPromptConsumed={() => setHealixPendingPrompt(null)}
      />
    </>
  )
}

