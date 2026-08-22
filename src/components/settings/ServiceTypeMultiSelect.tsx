'use client'

import { Label } from '@/components/ui/label'
import {
  ELIGIBILITY_SERVICE_TYPES,
  SERVICE_TYPE_GROUP_LABELS,
  type ServiceTypeGroup,
} from '@/lib/eligibility/service-types'

const GROUPS: ServiceTypeGroup[] = ['general', 'medical', 'dental']

interface ServiceTypeMultiSelectProps {
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}

export function ServiceTypeMultiSelect({
  value,
  onChange,
  disabled,
}: ServiceTypeMultiSelectProps) {
  const selected = new Set(value.map((code) => code.toUpperCase()))

  const toggle = (code: string) => {
    if (disabled) return
    const key = code.toUpperCase()
    const next = selected.has(key)
      ? value.filter((item) => item.toUpperCase() !== key)
      : [...value, code]
    onChange(next)
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <div>
        <Label>Service types</Label>
        <p className="text-sm text-gray-500 mt-1">
          Dental practices should select only 35 (Dental Care). Medical practices should select
          only 30. Payers return copays, coinsurance, and limitations on that one check. Listing
          every procedure code often comes back as non-covered with no dollar amounts.
        </p>
      </div>
      {GROUPS.map((group) => {
        const options = ELIGIBILITY_SERVICE_TYPES.filter((item) => item.group === group)
        return (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {SERVICE_TYPE_GROUP_LABELS[group]}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((item) => {
                const checked = selected.has(item.code.toUpperCase())
                return (
                  <label
                    key={item.code}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                      checked ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                    } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(item.code)}
                    />
                    <span>
                      <span className="font-medium text-gray-900">{item.code}</span>
                      <span className="text-gray-600"> — {item.label}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
