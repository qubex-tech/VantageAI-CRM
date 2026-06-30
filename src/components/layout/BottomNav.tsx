'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Home, Users, Inbox, MoreHorizontal, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'

const primaryNavItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appts', icon: Calendar },
  { href: '/communications', label: 'Inbox', icon: Inbox },
]

const moreNavItems = [
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/forms', label: 'Forms' },
  { href: '/marketing', label: 'Marketing' },
  { href: '/calls', label: 'Calls' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/workflows/automations', label: 'Workflows' },
  { href: '/settings', label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreOpen])

  const isMoreActive = moreNavItems.some(item => pathname.startsWith(item.href))

  return (
    <>
      {moreOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm md:hidden safe-area-pb">
        {moreOpen && (
          <div 
            ref={menuRef}
            className="absolute bottom-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg rounded-t-2xl px-4 py-3 animate-in slide-in-from-bottom-2 duration-200"
          >
            <div className="grid grid-cols-3 gap-2">
              {moreNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-xs rounded-xl transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-900 font-semibold"
                        : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                    )}
                  >
                    <span className={cn("font-medium", isActive && "font-semibold")}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex h-16 items-center justify-around px-2">
          {primaryNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[56px] text-[11px] transition-colors rounded-lg active:bg-gray-100",
                  isActive
                    ? "text-gray-900"
                    : "text-gray-500"
                )}
              >
                <Icon className={cn("h-6 w-6", isActive ? "text-gray-900" : "text-gray-400")} />
                <span className={cn("font-medium", isActive && "font-semibold")}>{item.label}</span>
              </Link>
            )
          })}
          
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[56px] text-[11px] transition-colors rounded-lg active:bg-gray-100",
              isMoreActive || moreOpen
                ? "text-gray-900"
                : "text-gray-500"
            )}
          >
            <MoreHorizontal className={cn("h-6 w-6", (isMoreActive || moreOpen) ? "text-gray-900" : "text-gray-400")} />
            <span className={cn("font-medium", (isMoreActive || moreOpen) && "font-semibold")}>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}

