'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  variant?: 'default' | 'icon'
}

export function LogoutButton({ variant = 'default' }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        setLoading(false)
        alert('Error signing out. Please try again.')
      } else {
        // Use window.location for a full page reload to ensure middleware detects the logout
        window.location.href = '/login?message=You have been signed out successfully'
      }
    } catch (error) {
      console.error('Logout error:', error)
      setLoading(false)
      alert('An error occurred while signing out.')
    }
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        onClick={handleLogout}
        disabled={loading}
        className="w-full justify-center"
        title="Sign out"
      >
        <LogOut className="h-5 w-5" />
        <span className="sr-only">Sign out</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      disabled={loading}
      className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? 'Signing out...' : 'Sign Out'}
    </Button>
  )
}

