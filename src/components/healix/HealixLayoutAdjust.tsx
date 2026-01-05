'use client'

import { useHealixOpen } from './HealixButton'
import { useEffect } from 'react'

interface HealixLayoutAdjustProps {
  children: React.ReactNode
}

/**
 * Adjusts layout when Healix panel is open
 * Uses CSS custom properties to set available width dynamically
 * On mobile: content stays full width (panel overlays on top)
 * On desktop: content shrinks to make room for Healix panel
 */
export function HealixLayoutAdjust({ children }: HealixLayoutAdjustProps) {
  const healixOpen = useHealixOpen()

  useEffect(() => {
    // Set CSS custom property based on Healix state
    // Healix panel widths: 384px (sm/md) or 420px (lg)
    const root = document.documentElement
    if (healixOpen) {
      root.style.setProperty('--healix-panel-width', '384px') // Default for md
      root.style.setProperty('--healix-panel-width-lg', '420px') // For lg screens
    } else {
      root.style.setProperty('--healix-panel-width', '0px')
      root.style.setProperty('--healix-panel-width-lg', '0px')
    }

    return () => {
      // Cleanup on unmount
      root.style.removeProperty('--healix-panel-width')
      root.style.removeProperty('--healix-panel-width-lg')
    }
  }, [healixOpen])

  return (
    <div 
      className="flex min-h-screen flex-col bg-white relative overflow-x-hidden"
      style={{
        width: '100%',
        maxWidth: '100vw',
      }}
    >
      {children}
    </div>
  )
}

