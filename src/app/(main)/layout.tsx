import { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarProvider'
import { Header } from '@/components/layout/Header'
import { HealixLayoutAdjust } from '@/components/healix/HealixLayoutAdjust'

/**
 * Main App Layout
 * Includes sidebar and header for staff/admin routes
 */
export default function MainLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <HealixLayoutAdjust>
        <Sidebar />
        <Header />
        <main className="flex-1 pb-16 md:pb-0 md:ml-64 md:pt-14 bg-white transition-all duration-300 ease-in-out overflow-x-hidden main-content-healix">
          {children}
        </main>
      </HealixLayoutAdjust>
    </SidebarProvider>
  )
}
