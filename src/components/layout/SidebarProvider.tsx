'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  isCollapsed: boolean
  setIsCollapsed: (isCollapsed: boolean) => void
  isPreVisitFocus: boolean
  setIsPreVisitFocus: (isPreVisitFocus: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false) // For mobile sidebar
  const [isCollapsed, setIsCollapsed] = useState(false) // For desktop sidebar
  const [isPreVisitFocus, setIsPreVisitFocus] = useState(false)

  return (
    <SidebarContext.Provider
      value={{ isOpen, setIsOpen, isCollapsed, setIsCollapsed, isPreVisitFocus, setIsPreVisitFocus }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

