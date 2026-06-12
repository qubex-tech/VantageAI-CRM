import { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarProvider'
import { PageHeaderExtrasProvider } from '@/components/layout/PageHeaderExtrasContext'
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
      <PageHeaderExtrasProvider>
        <HealixLayoutAdjust>
          <Sidebar />
          <Header />
          <MainContentWrapper>
            {children}
          </MainContentWrapper>
        </HealixLayoutAdjust>
      </PageHeaderExtrasProvider>
    </SidebarProvider>
  )
}
