'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type PageHeaderExtrasContextValue = {
  extras: ReactNode
  setExtras: (node: ReactNode) => void
}

export const PageHeaderExtrasContext = createContext<PageHeaderExtrasContextValue | null>(null)

export function PageHeaderExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtras] = useState<ReactNode>(null)
  const value = useMemo(() => ({ extras, setExtras }), [extras])

  return (
    <PageHeaderExtrasContext.Provider value={value}>
      {children}
    </PageHeaderExtrasContext.Provider>
  )
}

export function usePageHeaderExtras() {
  const context = useContext(PageHeaderExtrasContext)
  if (!context) {
    throw new Error('usePageHeaderExtras must be used within PageHeaderExtrasProvider')
  }
  return context
}
