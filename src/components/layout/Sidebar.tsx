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
  Phone,
  Workflow,
  Zap,
  Megaphone,
  FileText,
  CheckSquare,
  BarChart3,
  Inbox,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { LogoutButton } from './LogoutButton'
import { useSidebar } from './SidebarProvider'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/communications', label: 'Inbox', icon: Inbox },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/forms', label: 'Forms', icon: FileText },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/workflows/automations', label: 'Workflow Automations', icon: Zap },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, setIsOpen, isCollapsed, setIsCollapsed } = useSidebar()
  const [inboxUnread, setInboxUnread] = useState(0)
  const lastUnreadRef = useRef(0)
  const [practiceName, setPracticeName] = useState<string | null>(null)

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Auto-collapse on Inbox for more space
  useEffect(() => {
    if (pathname.startsWith('/communications')) {
      setIsCollapsed(true)
    } else {
      setIsCollapsed(false)
    }
  }, [pathname, setIsCollapsed])

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

  useEffect(() => {
    const readUnread = () => {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem('inboxUnreadCount')
      const nextValue = raw ? Number(raw) : 0
      setInboxUnread(Number.isFinite(nextValue) ? nextValue : 0)
    }

    readUnread()
    const handleUpdate = () => readUnread()
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('inbox-unread-updated', handleUpdate)
    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('inbox-unread-updated', handleUpdate)
    }
  }, [])

  // Fetch practice name for white-label sidebar
  useEffect(() => {
    let cancelled = false
    fetch('/api/user/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.practiceName != null) {
          setPracticeName(data.practiceName)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      return
    }

    const source = new EventSource('/api/notifications/inbox')

    const handleUnread = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data ?? '{}') as {
          unreadCount?: number
          latest?: { patientName?: string; lastMessageSnippet?: string }
        }
        const nextValue = Number(payload.unreadCount ?? 0)
        if (!Number.isFinite(nextValue)) return
        setInboxUnread(nextValue)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('inboxUnreadCount', String(nextValue))
          window.dispatchEvent(
            new CustomEvent('inbox-unread-updated', { detail: { source: 'sse' } })
          )
        }
        if (
          nextValue > lastUnreadRef.current &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(
            payload.latest?.patientName
              ? `New message from ${payload.latest.patientName}`
              : 'New message received',
            {
              body: payload.latest?.lastMessageSnippet || 'New message received',
            }
          )
        }
        lastUnreadRef.current = nextValue
      } catch {
        // Ignore malformed payloads.
      }
    }

    source.addEventListener('unread', handleUnread)

    return () => {
      source.removeEventListener('unread', handleUnread)
      source.close()
    }
  }, [])

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
          {/* Logo/Header - padding aligned with nav for a clean, consistent inset */}
          <div className={cn(
            "flex items-center justify-between gap-3 border-b border-gray-200 px-4",
            !isCollapsed && practiceName ? "h-auto min-h-14 py-3" : "h-14"
          )}>
            {!isCollapsed && (
              <Link
                href="/dashboard"
                className="flex flex-col gap-0.5 min-w-0 flex-1 py-1 -mx-1 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-inset"
                onClick={() => setIsOpen(false)}
              >
                <span className="text-lg font-semibold text-gray-900 tracking-tight">
                  Vantage AI
                </span>
                {practiceName && (
                  <span className="text-xs font-medium text-gray-500 truncate max-w-[180px]">
                    {practiceName}
                  </span>
                )}
              </Link>
            )}
            {isCollapsed && (
              <div className="w-full flex justify-center flex-1">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">V</span>
                </div>
              </div>
            )}
            {/* Collapse button (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
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

          {/* Navigation - same horizontal padding as header for aligned, clean look */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
                  {item.href === '/communications' && inboxUnread > 0 && (
                    <span
                      className={cn(
                        "ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white",
                        isCollapsed &&
                          "absolute -top-1 -right-1 ml-0 min-w-0 px-1.5 py-1 text-[10px] shadow"
                      )}
                    >
                      {inboxUnread > 99 ? '99+' : inboxUnread}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Logout button */}
          <div className="px-4 py-4 border-t border-gray-200">
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

