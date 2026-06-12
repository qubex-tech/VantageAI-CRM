import { Suspense, type ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarProvider'
import { PageHeaderExtrasProvider } from '@/components/layout/PageHeaderExtrasContext'
import { Header } from '@/components/layout/Header'
import { HealixLayoutAdjust } from '@/components/healix/HealixLayoutAdjust'
import { MainContentWrapper } from '@/components/layout/MainContentWrapper'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { AppUserProvider } from '@/components/layout/AppUserProvider'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { prisma } from '@/lib/db'

/**
 * Main App Layout
 * Includes sidebar and header for staff/admin routes
 */
export default async function MainLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getAuthenticatedUser()
  let practiceName: string | null = null

  if (user?.practiceId) {
    const practice = await prisma.practice.findUnique({
      where: { id: user.practiceId },
      select: { name: true },
    })
    practiceName = practice?.name ?? null
  }

  return (
    <AppUserProvider practiceName={practiceName}>
      <SidebarProvider>
        <PageHeaderExtrasProvider>
          <HealixLayoutAdjust>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <Sidebar />
            <Header />
            <MainContentWrapper>{children}</MainContentWrapper>
          </HealixLayoutAdjust>
        </PageHeaderExtrasProvider>
      </SidebarProvider>
    </AppUserProvider>
  )
}
