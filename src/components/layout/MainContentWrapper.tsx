'use client'

import { ReactNode } from 'react'
import { useSidebar } from './SidebarProvider'
import { cn } from '@/lib/utils'

export function MainContentWrapper({ children }: { children: ReactNode }) {
  const { isCollapsed, isPreVisitFocus } = useSidebar()
  const effectiveCollapsed = isCollapsed || isPreVisitFocus
  
  return (
    <main 
      className={cn(
        "flex-1 pt-14 bg-white transition-all duration-300 ease-in-out overflow-x-hidden main-content-healix",
        effectiveCollapsed ? "md:ml-16" : "md:ml-64"
      )}
      style={{
        ['--sidebar-width' as string]: effectiveCollapsed ? '64px' : '256px',
      }}
    >
      {children}
    </main>
  )
}
