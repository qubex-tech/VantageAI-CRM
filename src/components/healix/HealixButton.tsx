'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { HealixPanel } from './HealixPanel'
import { useHealixContext } from '@/hooks/useHealixContext'

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

export function HealixButton({
  patientId,
  appointmentId,
  invoiceId,
  screenTitle,
  visibleFields,
}: HealixButtonProps) {
  const [open, setOpen] = useState(false)
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
        onClick={() => setOpen(!open)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Healix</span>
      </Button>
      <HealixPanel open={open} onOpenChange={setOpen} context={context} />
    </>
  )
}

