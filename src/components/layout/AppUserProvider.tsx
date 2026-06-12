'use client'

import { createContext, useContext, type ReactNode } from 'react'

type AppUserContextValue = {
  practiceName: string | null
}

const AppUserContext = createContext<AppUserContextValue>({ practiceName: null })

export function AppUserProvider({
  practiceName,
  children,
}: {
  practiceName: string | null
  children: ReactNode
}) {
  return (
    <AppUserContext.Provider value={{ practiceName }}>{children}</AppUserContext.Provider>
  )
}

export function useAppUser() {
  return useContext(AppUserContext)
}
