'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  Play,
  Plus,
  Trash2,
  Upload,
  Loader2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LIST_CSV_HEADERS } from '@/lib/lists/constants'

type MemberRow = {
  id: string
  source: string
  matchedBy: string | null
  createdAt: string | Date
  patient: {
    id: string
    name: string
    email: string | null
    phone: string
    primaryPhone: string | null
    dateOfBirth: string | Date | null
  }
}

type ImportSummary = {
  importId: string
  totalRows: number
  matchedCount: number
  createdCount: number
  skippedCount: number
  errorCount: number
}

type ListDetail = {
  id: string
  name: string
  description: string | null
  memberCount: number
}

type PatientOption = {
  id: string
  name: string
  email?: string | null
  primaryPhone?: string | null
  phone?: string | null
  dateOfBirth?: string | Date | null
}

export function ListDetailClient({
  list,
  initialMembers,
  initialTotal,
}: {
  list: ListDetail
  initialMembers: MemberRow[]
  initialTotal: number
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState(initialMembers)
  const [total, setTotal] = useState(initialTotal)
  const [memberCount, setMemberCount] = useState(list.memberCount)
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastImport, setLastImport] = useState<ImportSummary | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addTab, setAddTab] = useState<'existing' | 'new'>('existing')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PatientOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDob, setNewDob] = useState('')

  const resetAddForm = () => {
    setAddTab('existing')
    setAddError('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedPatient(null)
    setNewName('')
    setNewPhone('')
    setNewEmail('')
    setNewDob('')
  }

  useEffect(() => {
    if (!addOpen || addTab !== 'existing' || !searchQuery.trim() || selectedPatient) {
      if (!searchQuery.trim()) setSearchResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(searchQuery.trim())}&limit=8`
        )
        const data = await res.json()
        setSearchResults(data.patients || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [addOpen, addTab, searchQuery, selectedPatient])

  const downloadTemplate = () => {
    const csv = `${LIST_CSV_HEADERS.join(',')}\nJane Doe,jane@example.com,+15551234567,1990-01-15\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'patient-list-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const refreshMembers = async () => {
    const res = await fetch(`/api/lists/${list.id}/members`)
    const data = await res.json()
    if (res.ok) {
      setMembers(data.members || [])
      setTotal(data.total || 0)
    }
    const listRes = await fetch(`/api/lists/${list.id}`)
    const listData = await listRes.json()
    if (listRes.ok && listData.list) {
      setMemberCount(listData.list.memberCount)
    }
  }

  const addPatientToListById = async (patientId: string) => {
    const res = await fetch(`/api/lists/${list.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add patient to list')
    return data as { status: 'added' | 'already_member'; list?: { memberCount: number } }
  }

  const handleAddExisting = async () => {
    if (!selectedPatient) {
      setAddError('Select a patient to add')
      return
    }
    setAddSaving(true)
    setAddError('')
    setError('')
    setMessage('')
    try {
      const result = await addPatientToListById(selectedPatient.id)
      setAddOpen(false)
      resetAddForm()
      setMessage(
        result.status === 'already_member'
          ? `${selectedPatient.name} is already on this list.`
          : `Added ${selectedPatient.name} to the list.`
      )
      if (result.list?.memberCount != null) {
        setMemberCount(result.list.memberCount)
      }
      await refreshMembers()
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add patient')
    } finally {
      setAddSaving(false)
    }
  }

  const handleCreateAndAdd = async () => {
    const name = newName.trim()
    const phone = newPhone.trim()
    if (!name) {
      setAddError('Name is required')
      return
    }
    if (!phone) {
      setAddError('Phone is required')
      return
    }

    setAddSaving(true)
    setAddError('')
    setError('')
    setMessage('')
    try {
      const createRes = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: newEmail.trim() || undefined,
          dateOfBirth: newDob || undefined,
          preferredContactMethod: 'phone',
          consentSource: 'staff',
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create patient')
      }

      const patientId = createData.patient?.id as string | undefined
      if (!patientId) {
        throw new Error('Patient created but no ID returned')
      }

      const result = await addPatientToListById(patientId)
      setAddOpen(false)
      resetAddForm()
      setMessage(
        result.status === 'already_member'
          ? `Patient already on this list.`
          : `Created ${name} and added them to the list.`
      )
      if (result.list?.memberCount != null) {
        setMemberCount(result.list.memberCount)
      }
      await refreshMembers()
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create patient')
    } finally {
      setAddSaving(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/lists/${list.id}/import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setLastImport(data.result)
      setMessage(
        `Import complete: ${data.result.matchedCount} matched, ${data.result.createdCount} created, ${data.result.skippedCount} skipped.`
      )
      await refreshMembers()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/lists/${list.id}/run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to run automations')
      setMessage(
        `Queued automations for ${data.result.emitted} of ${data.result.memberCount} patients on this list.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run automations')
    } finally {
      setRunning(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete list "${list.name}"? This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/lists/${list.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete list')
      router.push('/lists')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list')
      setDeleting(false)
    }
  }

  const handleClearList = async () => {
    if (
      !confirm(
        `Clear list "${list.name}"?\n\nThis will remove all patients from this list, but it will NOT delete patient records from CRM.\n\nThis action cannot be undone.`
      )
    ) {
      return
    }

    setClearing(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/lists/${list.id}/members`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear list')

      setMembers([])
      setTotal(0)
      setMemberCount(0)
      setMessage(`Cleared list. Removed ${data.removedCount || 0} patients from this list.`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear list')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/lists"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            All lists
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{list.name}</h1>
          {list.description && <p className="text-sm text-gray-600">{list.description}</p>}
          <p className="text-sm text-gray-500">
            {memberCount} {memberCount === 1 ? 'patient' : 'patients'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetAddForm()
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white">
                <UserPlus className="mr-2 h-4 w-4" />
                Add patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add patient to list</DialogTitle>
                <DialogDescription>
                  Add someone already in the CRM, or create a new patient and put them on this list.
                </DialogDescription>
              </DialogHeader>

              <Tabs
                value={addTab}
                onValueChange={(value) => {
                  setAddTab(value as 'existing' | 'new')
                  setAddError('')
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="existing" className="flex-1">
                    Existing patient
                  </TabsTrigger>
                  <TabsTrigger value="new" className="flex-1">
                    New patient
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-4 space-y-3">
                  {selectedPatient ? (
                    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-gray-900">{selectedPatient.name}</div>
                        <div className="text-xs text-gray-500">
                          {selectedPatient.primaryPhone ||
                            selectedPatient.phone ||
                            selectedPatient.email ||
                            'No phone'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPatient(null)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="patient-search">Search patients</Label>
                      <Input
                        id="patient-search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, email, or phone…"
                        autoFocus
                      />
                      {searching && <p className="text-xs text-gray-400">Searching…</p>}
                      {searchResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
                          {searchResults.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(patient)
                                setSearchQuery('')
                                setSearchResults([])
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              <span className="font-medium text-gray-900">{patient.name}</span>
                              <span className="ml-3 truncate text-xs text-gray-400">
                                {patient.primaryPhone || patient.phone || 'No phone'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.trim() && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-gray-500">
                          No matches. Try a different search, or create a new patient.
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Name *</Label>
                    <Input
                      id="new-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-phone">Phone *</Label>
                    <Input
                      id="new-phone"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-dob">Date of birth</Label>
                    <Input
                      id="new-dob"
                      type="date"
                      value={newDob}
                      onChange={(e) => setNewDob(e.target.value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {addError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {addError}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={addSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                  disabled={addSaving || (addTab === 'existing' && !selectedPatient)}
                  onClick={() => {
                    if (addTab === 'existing') void handleAddExisting()
                    else void handleCreateAndAdd()
                  }}
                >
                  {addSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {addTab === 'existing' ? 'Add to list' : 'Create & add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            CSV template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
            }}
          />
          <Button size="sm" onClick={handleRun} disabled={running || memberCount === 0}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run automations
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearList}
            disabled={clearing || memberCount === 0}
          >
            {clearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Clear List
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
            Delete
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV upload</CardTitle>
          <CardDescription>
            Columns: Patient Name, Email Address, Phone Number, Date of Birth. Existing patients are
            matched by email then phone, using DOB to disambiguate duplicates. Unmatched rows create
            new CRM patients. Each imported patient is tagged with this list name on their profile.
          </CardDescription>
        </CardHeader>
        {lastImport && (
          <CardContent className="text-sm text-gray-700">
            Last import — matched: {lastImport.matchedCount}, created: {lastImport.createdCount},
            skipped: {lastImport.skippedCount}, errors: {lastImport.errorCount}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Members ({total})</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add patient
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-gray-600">
              No patients on this list yet. Add a patient or upload a CSV to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Phone</th>
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 font-medium">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/patients/${member.patient.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {member.patient.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{member.patient.email || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {member.patient.primaryPhone || member.patient.phone || '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{member.source}</td>
                      <td className="py-2 text-gray-600">{member.matchedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
