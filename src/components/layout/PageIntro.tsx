import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageIntroProps {
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageIntro({ description, actions, className }: PageIntroProps) {
  if (!description && !actions) return null

  return (
    <div
      className={cn(
        'pt-5 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {description ? (
        typeof description === 'string' ? (
          <p className="text-sm text-gray-500">{description}</p>
        ) : (
          description
        )
      ) : (
        <span />
      )}
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}
