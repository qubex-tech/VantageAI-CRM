'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Filter, Plus, Save, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface FilterRule {
  id: string
  field: string
  operator: string
  value: string
}

export interface SavedFilter {
  id: string
  name: string
  searchQuery: string
  filters: FilterRule[]
}

interface PatientFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: FilterRule[]
  onFiltersChange: (filters: FilterRule[]) => void
}

const STORAGE_KEY = 'patient_saved_filters'

const fieldOptions = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'age', label: 'Age' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'appointment_date', label: 'Appointment Date' },
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

const dateOperatorOptions = [
  { value: 'is_tomorrow', label: 'is tomorrow' },
  { value: 'is_today', label: 'is today' },
  { value: 'is_in_next_7_days', label: 'is in next 7 days' },
  { value: 'is_in_next_30_days', label: 'is in next 30 days' },
  { value: 'equals', label: 'equals' },
  { value: 'before', label: 'before' },
  { value: 'after', label: 'after' },
  { value: 'is_not_empty', label: 'has appointment' },
  { value: 'is_empty', label: 'has no appointments' },
]

export function PatientFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
}: PatientFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [activeTab, setActiveTab] = useState<string>('default')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [filterName, setFilterName] = useState('')

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSavedFilters(parsed)
      }
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }, [])

  // Save filters to localStorage whenever savedFilters changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFilters))
    } catch (error) {
      console.error('Error saving filters to localStorage:', error)
    }
  }, [savedFilters])

  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      alert('Please enter a name for this filter')
      return
    }

    const newSavedFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: filterName.trim(),
      searchQuery,
      filters: [...filters],
    }

    setSavedFilters([...savedFilters, newSavedFilter])
    setFilterName('')
    setSaveDialogOpen(false)
    setActiveTab(newSavedFilter.id)
  }

  const handleLoadFilter = (savedFilter: SavedFilter) => {
    onSearchChange(savedFilter.searchQuery)
    onFiltersChange(savedFilter.filters)
    setActiveTab(savedFilter.id)
  }

  const handleDeleteFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this saved filter?')) {
      const updated = savedFilters.filter((f) => f.id !== id)
      setSavedFilters(updated)
      if (activeTab === id) {
        setActiveTab('default')
        onSearchChange('')
        onFiltersChange([])
      }
    }
  }

  const handleDefaultTab = () => {
    setActiveTab('default')
    onSearchChange('')
    onFiltersChange([])
  }

  const hasActiveFilters = searchQuery || filters.length > 0

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
      {/* Saved Filters Tabs */}
      <div className="flex items-center gap-2">
        <Tabs value={activeTab} onValueChange={(value) => {
          if (value === 'default') {
            handleDefaultTab()
          } else {
            const savedFilter = savedFilters.find((f) => f.id === value)
            if (savedFilter) {
              handleLoadFilter(savedFilter)
            }
          }
        }} className="flex-1">
          <TabsList className="w-full justify-start h-auto p-1 bg-gray-100">
            <TabsTrigger value="default" className="data-[state=active]:bg-white">
              All Patients
            </TabsTrigger>
            {savedFilters.map((savedFilter) => (
              <TabsTrigger
                key={savedFilter.id}
                value={savedFilter.id}
                className="data-[state=active]:bg-white relative group pr-6"
              >
                {savedFilter.name}
                <button
                  onClick={(e) => handleDeleteFilter(savedFilter.id, e)}
                  className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {hasActiveFilters && (
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 whitespace-nowrap"
              >
                <Save className="mr-2 h-4 w-4" />
                Save filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Filter</DialogTitle>
                <DialogDescription>
                  Give this filter a name so you can use it again later.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Filter name (e.g., 'VIP Patients', 'Recent Appointments')"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveFilter()
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSaveDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveFilter}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {(filter.field === 'appointment_date' ? dateOperatorOptions : operatorOptions).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {filter.field === 'appointment_date' ? (
                      // Date-specific input handling
                      (filter.operator === 'equals' || filter.operator === 'before' || filter.operator === 'after') ? (
                        <Input
                          type="date"
                          value={filter.value}
                          onChange={(e) =>
                            handleUpdateFilter(filter.id, { value: e.target.value })
                          }
                          className="flex-1"
                        />
                      ) : null
                    ) : (
                      // Regular input for other fields
                      filter.operator !== 'is_empty' &&
                      filter.operator !== 'is_not_empty' && (
                        <Input
                          placeholder="Enter value..."
                          value={filter.value}
                          onChange={(e) =>
                            handleUpdateFilter(filter.id, { value: e.target.value })
                          }
                          className="flex-1"
                        />
                      )
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

