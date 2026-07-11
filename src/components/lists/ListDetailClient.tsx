'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  Play,
  Trash2,
  Upload,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <CardHeader>
          <CardTitle className="text-base">Members ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-gray-600">No patients on this list yet. Upload a CSV to begin.</p>
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
