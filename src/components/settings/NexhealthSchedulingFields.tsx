'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, X } from 'lucide-react'
import type {
  NexhealthBookSlotConfig,
  NexhealthReadSlotConfig,
  VisitTypeMapping,
} from '@/lib/integrations/clinical-system/types'

const LENGTH_OPTIONS = [15, 20, 30, 40, 45, 60, 90]

type CatalogItem = { id: number; name: string }

interface NexhealthSchedulingFieldsProps {
  practiceId: string
  showRead: boolean
  showWrite: boolean
  readConfigs: NexhealthReadSlotConfig[]
  bookConfigs: NexhealthBookSlotConfig[]
  onChangeRead: (configs: NexhealthReadSlotConfig[]) => void
  onChangeBook: (configs: NexhealthBookSlotConfig[]) => void
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function NexhealthSchedulingFields({
  practiceId,
  showRead,
  showWrite,
  readConfigs,
  bookConfigs,
  onChangeRead,
  onChangeBook,
}: NexhealthSchedulingFieldsProps) {
  const [providers, setProviders] = useState<CatalogItem[]>([])
  const [operatories, setOperatories] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [providerId, setProviderId] = useState('')
  const [operatoryIds, setOperatoryIds] = useState<number[]>([])
  const [lengthMinutes, setLengthMinutes] = useState('30')
  const [visitType, setVisitType] = useState('')
  const [aliases, setAliases] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const withPractice = (path: string) =>
          `${path}${path.includes('?') ? '&' : '?'}practiceId=${encodeURIComponent(practiceId)}`
        const [providerRes, operatoryRes] = await Promise.all([
          fetch(withPractice('/api/integrations/nexhealth/providers')),
          fetch(withPractice('/api/integrations/nexhealth/operatories')),
        ])
        const providerData = await providerRes.json()
        const operatoryData = await operatoryRes.json()
        if (!providerRes.ok) throw new Error(providerData.error || 'Failed to load providers')
        if (!operatoryRes.ok) throw new Error(operatoryData.error || 'Failed to load operatories')
        setProviders(providerData.providers || [])
        setOperatories(operatoryData.operatories || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load NexHealth scheduling lists')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [practiceId])

  const toggleOperatory = (id: number) => {
    setOperatoryIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }

  const providerName = (id: number) => providers.find((provider) => provider.id === id)?.name || `Provider ${id}`
  const operatoryName = (id: number) => operatories.find((operatory) => operatory.id === id)?.name || `Operatory ${id}`

  const addRead = () => {
    const id = Number(providerId)
    const length = Number(lengthMinutes)
    if (!id || operatoryIds.length === 0 || !length) return
    onChangeRead([
      ...readConfigs,
      { providerId: id, operatoryIds: [...operatoryIds], lengthMinutes: length },
    ])
    setOperatoryIds([])
  }

  const addBook = () => {
    const id = Number(providerId)
    const length = Number(lengthMinutes)
    if (!id || operatoryIds.length === 0 || !length) return
    const visitTypes: VisitTypeMapping[] = visitType.trim()
      ? [{ visitType: visitType.trim(), aliases: parseList(aliases) }]
      : []
    onChangeBook([
      ...bookConfigs,
      { providerId: id, operatoryIds: [...operatoryIds], lengthMinutes: length, visitTypes },
    ])
    setVisitType('')
    setAliases('')
    setOperatoryIds([])
  }

  return (
    <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
      <div>
        <p className="text-sm font-medium text-gray-700">NexHealth providers and operatories</p>
        <p className="text-xs text-gray-500 mt-1">
          Used when availability or booking is set to NexHealth. A booking row with no visit type is
          the default. Add a visit type and comma-separated aliases when the voice agent should route
          a request to a specific provider.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading NexHealth providers...
        </div>
      ) : (
        <>
          {error && <p className="text-sm text-amber-800">{error}</p>}
          {showRead && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Reading time slots</p>
              {readConfigs.map((row, index) => (
                <div key={`read-${index}`} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {providerName(row.providerId)} · {row.operatoryIds.map(operatoryName).join(', ')} ·{' '}
                    {row.lengthMinutes} min
                  </span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-700"
                    onClick={() => onChangeRead(readConfigs.filter((_, i) => i !== index))}
                    aria-label="Remove reading row"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {showWrite && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Booking</p>
              {bookConfigs.map((row, index) => (
                <div key={`book-${index}`} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    {providerName(row.providerId)} · {row.operatoryIds.map(operatoryName).join(', ')} ·{' '}
                    {row.lengthMinutes} min
                    {row.visitTypes.length > 0
                      ? ` · ${row.visitTypes.map((vt) => vt.visitType).join(', ')}`
                      : ' · default'}
                  </span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-700"
                    onClick={() => onChangeBook(bookConfigs.filter((_, i) => i !== index))}
                    aria-label="Remove booking row"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={String(provider.id)}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lengthMinutes} onValueChange={setLengthMinutes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {showRead && (
                <Button type="button" variant="outline" onClick={addRead}>
                  <Plus className="h-4 w-4 mr-1" />
                  Read
                </Button>
              )}
              {showWrite && (
                <Button type="button" variant="outline" onClick={addBook}>
                  <Plus className="h-4 w-4 mr-1" />
                  Book
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {operatories.map((operatory) => {
              const selected = operatoryIds.includes(operatory.id)
              return (
                <button
                  key={operatory.id}
                  type="button"
                  onClick={() => toggleOperatory(operatory.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {operatory.name}
                </button>
              )
            })}
          </div>
          {showWrite && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                value={visitType}
                onChange={(event) => setVisitType(event.target.value)}
                placeholder="Visit type (leave blank for the default row)"
              />
              <Input
                value={aliases}
                onChange={(event) => setAliases(event.target.value)}
                placeholder="Aliases, comma separated"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
