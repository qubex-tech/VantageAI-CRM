'use client'

import { useEffect, useRef } from 'react'
import {
  groupVisitTypes,
  selectedVisitTypeNames,
  type VisitTypeGroupId,
} from '@/automations/visit-type-groups'

function GroupCheck({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  )
}

export function VisitTypePicker({
  visitTypes,
  value,
  loading,
  onChange,
}: {
  visitTypes: string[]
  value: unknown
  loading: boolean
  onChange: (next: string[]) => void
}) {
  const selectedNames = selectedVisitTypeNames(value)
  const available = [...visitTypes]
  for (const name of selectedNames) {
    if (!available.includes(name)) available.push(name)
  }
  const selected = new Set(selectedNames)
  const { groups, ungrouped } = groupVisitTypes(available)

  const toggleName = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    onChange(available.filter((visitType) => next.has(visitType)))
  }

  const toggleGroup = (id: VisitTypeGroupId, types: string[]) => {
    const allSelected = types.every((type) => selected.has(type))
    const next = new Set(selected)
    for (const type of types) {
      if (allSelected) next.delete(type)
      else next.add(type)
    }
    onChange(available.filter((visitType) => next.has(visitType)))
  }

  if (loading) {
    return <p className="text-xs text-gray-500">Loading visit types...</p>
  }
  if (available.length === 0) {
    return <p className="text-xs text-gray-500">No visit types available</p>
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
      {groups.map((group) => {
        const selectedCount = group.types.filter((type) => selected.has(type)).length
        const allSelected = selectedCount === group.types.length
        return (
          <div key={group.id}>
            <label className="flex items-start gap-2 text-sm font-medium text-gray-900">
              <GroupCheck
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                onChange={() => toggleGroup(group.id, group.types)}
                label={`${group.label} ${group.description}`}
              />
              <span>
                {group.label}
                <span className="ml-1 font-normal text-gray-500">{group.description}</span>
              </span>
            </label>
            <div className="mt-1 space-y-1 pl-6">
              {group.types.map((visitType) => (
                <label key={visitType} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                    checked={selected.has(visitType)}
                    onChange={() => toggleName(visitType)}
                  />
                  <span>{visitType}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
      {ungrouped.length > 0 && (
        <div className="space-y-1">
          {groups.length > 0 && <p className="text-xs font-medium text-gray-500">Other</p>}
          {ungrouped.map((visitType) => (
            <label key={visitType} className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                checked={selected.has(visitType)}
                onChange={() => toggleName(visitType)}
              />
              <span>{visitType}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
