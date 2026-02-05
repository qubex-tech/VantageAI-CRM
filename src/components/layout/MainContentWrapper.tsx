'use client'

import { ReactNode } from 'react'
import { useSidebar } from './SidebarProvider'
import { cn } from '@/lib/utils'

export function MainContentWrapper({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar()
  
  return (
    <main 
      className={cn(
        "flex-1 pb-16 md:pb-0 md:pt-14 bg-white transition-all duration-300 ease-in-out overflow-x-hidden main-content-healix",
        // Responsive margin based on sidebar state
        isCollapsed ? "md:ml-16" : "md:ml-64"
      )}
      style={{
        ['--sidebar-width' as string]: isCollapsed ? '64px' : '256px',
      }}
    >
      {children}
    </main>
  )
}
