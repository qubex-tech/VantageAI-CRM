'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Filter, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

export interface FilterRule {
  id: string
  field: string
  operator: string
  value: string
}

interface PatientFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: FilterRule[]
  onFiltersChange: (filters: FilterRule[]) => void
}

const fieldOptions = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'age', label: 'Age' },
  { value: 'appointments', label: 'Appointments' },
]

const operatorOptions = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

export function PatientFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
}: PatientFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  const handleAddFilter = () => {
    const newFilter: FilterRule = {
      id: `filter-${Date.now()}`,
      field: 'name',
      operator: 'contains',
      value: '',
    }
    onFiltersChange([...filters, newFilter])
  }

  const handleRemoveFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id))
  }

  const handleUpdateFilter = (id: string, updates: Partial<FilterRule>) => {
    onFiltersChange(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  const handleClearAll = () => {
    onFiltersChange([])
  }

  const activeFilterCount = filters.length

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Input
          placeholder="Search patients by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
      </div>

      {/* Advanced Filter Button */}
      <div className="flex items-center gap-2">
        <Button
          variant={isAdvancedOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className={isAdvancedOpen ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Filter className="mr-2 h-4 w-4" />
          Advanced filter {activeFilterCount > 0 && `(${activeFilterCount})`}
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-gray-600 hover:text-gray-900"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Advanced Filter Panel */}
      {isAdvancedOpen && (
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-4 space-y-4">
            {filters.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No filters applied</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFilter}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add filter
                </Button>
              </div>
            ) : (
              <>
                {filters.map((filter, index) => (
                  <div key={filter.id} className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="text-sm text-gray-500 whitespace-nowrap">Where</span>
                    )}
                    {index > 0 && (
                      <Select
                        value="and"
                        disabled
                        onValueChange={() => {}}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue>and</SelectValue>
                        </SelectTrigger>
                      </Select>
                    )}
                    
                    <Select
                      value={filter.field}
                      onValueChange={(value) =>
                        handleUpdateFilter(filter.id, { field: value })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(value) =>
                        handleUpdateFilter(filter.id, { operator: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {filter.operator !== 'is_empty' &&
                      filter.operator !== 'is_not_empty' && (
                        <Input
                          placeholder="Enter value..."
                          value={filter.value}
                          onChange={(e) =>
                            handleUpdateFilter(filter.id, { value: e.target.value })
                          }
                          className="flex-1"
                        />
                      )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveFilter(filter.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFilter}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add filter
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

