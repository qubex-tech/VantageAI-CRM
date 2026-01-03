'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface PracticeUser {
  name: string
  email: string
  password: string
}

interface Practice {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  users?: Array<{
    id: string
    email: string
    name: string
    role: string
    createdAt: string
  }>
  _count?: {
    patients: number
    appointments: number
  }
}

export function PracticeManagement() {
  const [practices, setPractices] = useState<Practice[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPractices, setLoadingPractices] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state
  const [practiceName, setPracticeName] = useState('')
  const [practiceAdmins, setPracticeAdmins] = useState<PracticeUser[]>([
    { name: '', email: '', password: '' }
  ])
  const [regularUsers, setRegularUsers] = useState<PracticeUser[]>([
    { name: '', email: '', password: '' }
  ])
  const [isCreating, setIsCreating] = useState(false)

  // Load practices on mount
  useEffect(() => {
    loadPractices()
  }, [])

  const loadPractices = async () => {
    try {
      setLoadingPractices(true)
      const response = await fetch('/api/practices')
      if (!response.ok) {
        throw new Error('Failed to load practices')
      }
      const data = await response.json()
      setPractices(data.practices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load practices')
    } finally {
      setLoadingPractices(false)
    }
  }

  const addPracticeAdmin = () => {
    setPracticeAdmins([...practiceAdmins, { name: '', email: '', password: '' }])
  }

  const removePracticeAdmin = (index: number) => {
    setPracticeAdmins(practiceAdmins.filter((_, i) => i !== index))
  }

  const updatePracticeAdmin = (index: number, field: keyof PracticeUser, value: string) => {
    const updated = [...practiceAdmins]
    updated[index] = { ...updated[index], [field]: value }
    setPracticeAdmins(updated)
  }

  const addRegularUser = () => {
    setRegularUsers([...regularUsers, { name: '', email: '', password: '' }])
  }

  const removeRegularUser = (index: number) => {
    setRegularUsers(regularUsers.filter((_, i) => i !== index))
  }

  const updateRegularUser = (index: number, field: keyof PracticeUser, value: string) => {
    const updated = [...regularUsers]
    updated[index] = { ...updated[index], [field]: value }
    setRegularUsers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // Validate practice name
    if (!practiceName.trim()) {
      setError('Practice name is required')
      return
    }

    // Filter out empty practice admin entries
    const validPracticeAdmins = practiceAdmins.filter(
      admin => admin.name.trim() && admin.email.trim() && admin.password.trim()
    )

    // Filter out empty regular user entries
    const validRegularUsers = regularUsers.filter(
      user => user.name.trim() && user.email.trim() && user.password.trim()
    )

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const allUsers = [...validPracticeAdmins, ...validRegularUsers]
    for (const user of allUsers) {
      if (!emailRegex.test(user.email)) {
        setError(`Invalid email address: ${user.email}`)
        return
      }
      if (user.password.length < 8) {
        setError(`Password for ${user.email} must be at least 8 characters`)
        return
      }
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: practiceName.trim(),
          practiceAdmins: validPracticeAdmins,
          regularUsers: validRegularUsers,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create practice')
      }

      const data = await response.json()
      setSuccess(`Practice "${data.practice.name}" created successfully with ${data.users.practiceAdmins.length} practice admin(s) and ${data.users.regularUsers.length} regular user(s)`)
      
      // Reset form
      setPracticeName('')
      setPracticeAdmins([{ name: '', email: '', password: '' }])
      setRegularUsers([{ name: '', email: '', password: '' }])
      
      // Reload practices
      await loadPractices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create practice')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Practice</CardTitle>
          <CardDescription>
            Create a new practice account with practice admin and regular users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Practice Name */}
            <div className="space-y-2">
              <Label htmlFor="practiceName">Practice Name *</Label>
              <Input
                id="practiceName"
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                placeholder="Enter practice name"
                required
              />
            </div>

            {/* Practice Admin Users */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Practice Admin Users</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Practice admins can manage users but not API configurations
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPracticeAdmin}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Admin
                </Button>
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                {practiceAdmins.map((admin, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`admin-name-${index}`}>Name</Label>
                      <Input
                        id={`admin-name-${index}`}
                        type="text"
                        value={admin.name}
                        onChange={(e) => updatePracticeAdmin(index, 'name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`admin-email-${index}`}>Email</Label>
                      <Input
                        id={`admin-email-${index}`}
                        type="email"
                        value={admin.email}
                        onChange={(e) => updatePracticeAdmin(index, 'email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="space-y-2 flex-1">
                        <Label htmlFor={`admin-password-${index}`}>Password</Label>
                        <Input
                          id={`admin-password-${index}`}
                          type="password"
                          value={admin.password}
                          onChange={(e) => updatePracticeAdmin(index, 'password', e.target.value)}
                          placeholder="Min 8 characters"
                          minLength={8}
                        />
                      </div>
                      {practiceAdmins.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePracticeAdmin(index)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regular Users */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Regular Users</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Regular users can use the CRM for their practice
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRegularUser}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                {regularUsers.map((user, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`user-name-${index}`}>Name</Label>
                      <Input
                        id={`user-name-${index}`}
                        type="text"
                        value={user.name}
                        onChange={(e) => updateRegularUser(index, 'name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`user-email-${index}`}>Email</Label>
                      <Input
                        id={`user-email-${index}`}
                        type="email"
                        value={user.email}
                        onChange={(e) => updateRegularUser(index, 'email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="space-y-2 flex-1">
                        <Label htmlFor={`user-password-${index}`}>Password</Label>
                        <Input
                          id={`user-password-${index}`}
                          type="password"
                          value={user.password}
                          onChange={(e) => updateRegularUser(index, 'password', e.target.value)}
                          placeholder="Min 8 characters"
                          minLength={8}
                        />
                      </div>
                      {regularUsers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRegularUser(index)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error and Success Messages */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Practice...
                </>
              ) : (
                'Create Practice'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Practices List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Practices</CardTitle>
          <CardDescription>
            View all practices in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPractices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : practices.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No practices yet. Create one above to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {practices.map((practice) => (
                <div
                  key={practice.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{practice.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <p>
                          {practice.users?.length || 0} user(s) •{' '}
                          {practice._count?.patients || 0} patient(s) •{' '}
                          {practice._count?.appointments || 0} appointment(s)
                        </p>
                        {practice.email && <p>Email: {practice.email}</p>}
                        {practice.phone && <p>Phone: {practice.phone}</p>}
                      </div>
                      {practice.users && practice.users.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-gray-700">Users:</p>
                          <div className="flex flex-wrap gap-2">
                            {practice.users.map((user) => (
                              <span
                                key={user.id}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700"
                              >
                                {user.name} ({user.email}) - {user.role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
