'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Users, 
  Calendar, 
  Settings, 
  Menu, 
  X,
  ChevronLeft,
  LogOut,
  Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'
import { LogoutButton } from './LogoutButton'
import { useSidebar } from './SidebarProvider'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, setIsOpen, isCollapsed, setIsCollapsed } = useSidebar()

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-gray-900" />
        ) : (
          <Menu className="h-5 w-5 text-gray-900" />
        )}
      </button>


      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-300 ease-in-out",
          // Mobile: slide in from left
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0", // Desktop: always visible
          // Collapsed state (desktop only)
          isCollapsed ? "md:w-16" : "md:w-64",
          "w-64" // Mobile width
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
            {!isCollapsed && (
              <Link 
                href="/dashboard" 
                className="text-lg font-semibold text-gray-900 tracking-tight"
                onClick={() => setIsOpen(false)}
              >
                Vantage AI
              </Link>
            )}
            {isCollapsed && (
              <div className="w-full flex justify-center">
                <div className="w-8 h-8 rounded-md bg-gray-900 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">V</span>
                </div>
              </div>
            )}
            {/* Collapse button (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft 
                className={cn(
                  "h-4 w-4 transition-transform",
                  isCollapsed && "rotate-180"
                )} 
              />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-gray-100",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700 hover:text-gray-900",
                    isCollapsed && "justify-center"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-gray-900")} />
                  {!isCollapsed && <span>{item.label}</span>}
                  {isCollapsed && (
                    <span className="sr-only">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Logout button */}
          <div className="px-3 py-4 border-t border-gray-200">
            <div className={cn(
              "flex items-center",
              isCollapsed && "justify-center"
            )}>
              {isCollapsed ? (
                <LogoutButton variant="icon" />
              ) : (
                <LogoutButton />
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Spacer for desktop sidebar - removed, sidebar is fixed */}
    </>
  )
}

