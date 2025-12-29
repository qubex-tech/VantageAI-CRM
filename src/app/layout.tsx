import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/SidebarProvider"

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
      <body className="font-sans antialiased bg-white text-gray-900">
        <SidebarProvider>
          <div className="flex min-h-screen flex-col bg-white">
            <Sidebar />
            <main className="flex-1 pb-16 md:pb-0 md:ml-64 bg-white">{children}</main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}

