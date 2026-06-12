'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const routeKey = `${pathname}?${searchParams.toString()}`

  useEffect(() => {
    setVisible(true)
    setProgress(18)

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
    }

    timerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current
        return current + Math.random() * 12
      })
    }, 180)

    const finishTimer = window.setTimeout(() => {
      setProgress(100)
      window.setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 200)
    }, 320)

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
      window.clearTimeout(finishTimer)
    }
  }, [routeKey])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-transparent"
    >
      <div
        className="h-full bg-blue-600 transition-[width] duration-200 ease-out shadow-[0_0_8px_rgba(37,99,235,0.45)]"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  )
}
