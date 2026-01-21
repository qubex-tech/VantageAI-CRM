import { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarProvider'
import { Header } from '@/components/layout/Header'
import { HealixLayoutAdjust } from '@/components/healix/HealixLayoutAdjust'
import { MainContentWrapper } from '@/components/layout/MainContentWrapper'

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
        <MainContentWrapper>
          {children}
        </MainContentWrapper>
      </HealixLayoutAdjust>
    </SidebarProvider>
  )
}
