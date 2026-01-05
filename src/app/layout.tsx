import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/SidebarProvider"
import { Header } from "@/components/layout/Header"
import { HealixLayoutAdjust } from "@/components/healix/HealixLayoutAdjust"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: "Vantage AI",
  description: "Medical Practice CRM with Cal.com and RetellAI integration",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white text-gray-900 overflow-x-hidden">
        <Analytics />
        <SpeedInsights />
        <SidebarProvider>
          <HealixLayoutAdjust>
            <Sidebar />
            <Header />
            <main className="flex-1 pb-16 md:pb-0 md:ml-64 md:pt-14 bg-white transition-all duration-300 ease-in-out overflow-x-hidden main-content-healix">
              {children}
            </main>
          </HealixLayoutAdjust>
        </SidebarProvider>
      </body>
    </html>
  )
}

