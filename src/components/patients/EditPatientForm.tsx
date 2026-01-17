'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Patient {
  id: string
  name: string
  // Basic Information
  externalEhrId?: string | null
  firstName?: string | null
  lastName?: string | null
  preferredName?: string | null
  dateOfBirth: Date | string | null
  // Contact Information
  primaryPhone?: string | null
  secondaryPhone?: string | null
  phone: string
  email: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  gender?: string | null
  pronouns?: string | null
  primaryLanguage?: string | null
  // Communication Preferences & Consent
  preferredContactMethod: string
  preferredChannel?: string | null
  smsOptIn?: boolean | null
  smsOptInAt?: Date | null
  emailOptIn?: boolean | null
  voiceOptIn?: boolean | null
  doNotContact?: boolean | null
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  consentSource?: string | null
  // Insurance Summary
  primaryInsuranceId?: string | null
  secondaryInsuranceId?: string | null
  insuranceStatus?: string | null
  lastInsuranceVerifiedAt?: Date | null
  selfPay?: boolean | null
  // Legacy
  notes: string | null
}

interface EditPatientFormProps {
  patient: Patient
  onCancel?: () => void
  onSuccess?: () => void
}

export function EditPatientForm({ patient, onCancel, onSuccess }: EditPatientFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basicInfo: true,
    contactInfo: false,
    communication: false,
    insurance: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime()) || d.getFullYear() < 1901) return ''
    return d.toISOString().split('T')[0]
  }

  // Format time for input (HH:mm)
  const formatTimeForInput = (time: string | null | undefined) => {
    if (!time) return ''
    return time
  }

  const [formData, setFormData] = useState({
    // Legacy fields
    name: patient.name || '',
    phone: patient.phone || patient.primaryPhone || '',
    address: patient.address || patient.addressLine1 || '',
    preferredContactMethod: patient.preferredContactMethod || 'phone',
    
    // Basic Information
    externalEhrId: patient.externalEhrId || '',
    firstName: patient.firstName || '',
    lastName: patient.lastName || '',
    preferredName: patient.preferredName || '',
    dateOfBirth: formatDateForInput(patient.dateOfBirth),
    
    // Contact Information
    primaryPhone: patient.primaryPhone || patient.phone || '',
    secondaryPhone: patient.secondaryPhone || '',
    email: patient.email || '',
    addressLine1: patient.addressLine1 || patient.address || '',
    addressLine2: patient.addressLine2 || '',
    city: patient.city || '',
    state: patient.state || '',
    postalCode: patient.postalCode || '',
    gender: patient.gender || '',
    pronouns: patient.pronouns || '',
    primaryLanguage: patient.primaryLanguage || '',
    
    // Communication Preferences & Consent
    preferredChannel: patient.preferredChannel || patient.preferredContactMethod || '',
    smsOptIn: patient.smsOptIn ?? false,
    smsOptInAt: formatDateForInput(patient.smsOptInAt),
    emailOptIn: patient.emailOptIn ?? false,
    voiceOptIn: patient.voiceOptIn ?? false,
    doNotContact: patient.doNotContact ?? false,
    quietHoursStart: formatTimeForInput(patient.quietHoursStart),
    quietHoursEnd: formatTimeForInput(patient.quietHoursEnd),
    consentSource: patient.consentSource || '',
    
    // Insurance Summary
    primaryInsuranceId: patient.primaryInsuranceId || '',
    secondaryInsuranceId: patient.secondaryInsuranceId || '',
    insuranceStatus: patient.insuranceStatus || '',
    lastInsuranceVerifiedAt: formatDateForInput(patient.lastInsuranceVerifiedAt),
    selfPay: patient.selfPay ?? false,
    
    // Legacy
    notes: patient.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Helper to convert empty strings to null
    const toNullIfEmpty = (value: string | null | undefined): string | null => {
      return value && value.trim() ? value.trim() : null
    }

    // Build update data - only include fields that have values or need to be updated
    const updateData: any = {}

    // Legacy fields - ensure name and phone are always set (required by Prisma)
    const displayName = formData.name || (formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}`.trim() : formData.firstName || formData.lastName)
    // Always set name - use existing if not provided
    updateData.name = displayName && displayName.trim() ? displayName.trim() : patient.name
    
    // Phone handling - ensure phone is always set (required by Prisma)
    const primaryPhoneValue = formData.primaryPhone?.trim() || ''
    const phoneValue = formData.phone?.trim() || primaryPhoneValue || patient.phone || patient.primaryPhone || ''
    
    if (phoneValue) {
      updateData.phone = phoneValue
    }
    
    // Set primaryPhone if provided, otherwise use phone value
    if (primaryPhoneValue) {
      updateData.primaryPhone = primaryPhoneValue
    } else if (phoneValue && phoneValue !== patient.primaryPhone) {
      updateData.primaryPhone = phoneValue
    }
    
    // Only update preferredContactMethod if it changed
    if (formData.preferredContactMethod && formData.preferredContactMethod !== patient.preferredContactMethod) {
      updateData.preferredContactMethod = formData.preferredContactMethod
    }

    // Basic Information - only include if changed
    if (formData.externalEhrId !== (patient.externalEhrId || '')) {
      updateData.externalEhrId = toNullIfEmpty(formData.externalEhrId)
    }
    if (formData.firstName !== (patient.firstName || '')) {
      updateData.firstName = toNullIfEmpty(formData.firstName)
    }
    if (formData.lastName !== (patient.lastName || '')) {
      updateData.lastName = toNullIfEmpty(formData.lastName)
    }
    if (formData.preferredName !== (patient.preferredName || '')) {
      updateData.preferredName = toNullIfEmpty(formData.preferredName)
    }
    if (formData.dateOfBirth !== formatDateForInput(patient.dateOfBirth)) {
      updateData.dateOfBirth = formData.dateOfBirth ? formData.dateOfBirth : null
    }

    // Contact Information - only include if changed
    if (formData.secondaryPhone !== (patient.secondaryPhone || '')) {
      updateData.secondaryPhone = toNullIfEmpty(formData.secondaryPhone)
    }
    if (formData.email !== (patient.email || '')) {
      updateData.email = toNullIfEmpty(formData.email)
    }
    if (formData.addressLine1 !== (patient.addressLine1 || patient.address || '')) {
      updateData.addressLine1 = toNullIfEmpty(formData.addressLine1)
    }
    if (formData.addressLine2 !== (patient.addressLine2 || '')) {
      updateData.addressLine2 = toNullIfEmpty(formData.addressLine2)
    }
    if (formData.city !== (patient.city || '')) {
      updateData.city = toNullIfEmpty(formData.city)
    }
    if (formData.state !== (patient.state || '')) {
      updateData.state = toNullIfEmpty(formData.state)
    }
    if (formData.postalCode !== (patient.postalCode || '')) {
      updateData.postalCode = toNullIfEmpty(formData.postalCode)
    }
    if (formData.gender !== (patient.gender || '')) {
      updateData.gender = formData.gender ? formData.gender : null
    }
    if (formData.pronouns !== (patient.pronouns || '')) {
      updateData.pronouns = toNullIfEmpty(formData.pronouns)
    }
    if (formData.primaryLanguage !== (patient.primaryLanguage || '')) {
      updateData.primaryLanguage = toNullIfEmpty(formData.primaryLanguage)
    }

    // Communication Preferences & Consent - only include if changed
    if (formData.preferredChannel !== (patient.preferredChannel || patient.preferredContactMethod || '')) {
      updateData.preferredChannel = formData.preferredChannel ? formData.preferredChannel : null
    }
    if (formData.smsOptIn !== (patient.smsOptIn ?? false)) {
      updateData.smsOptIn = formData.smsOptIn
    }
    if (formData.smsOptInAt !== formatDateForInput(patient.smsOptInAt)) {
      updateData.smsOptInAt = formData.smsOptInAt ? formData.smsOptInAt : null
    }
    if (formData.emailOptIn !== (patient.emailOptIn ?? false)) {
      updateData.emailOptIn = formData.emailOptIn
    }
    if (formData.voiceOptIn !== (patient.voiceOptIn ?? false)) {
      updateData.voiceOptIn = formData.voiceOptIn
    }
    if (formData.doNotContact !== (patient.doNotContact ?? false)) {
      updateData.doNotContact = formData.doNotContact
    }
    if (formData.quietHoursStart !== (patient.quietHoursStart || '')) {
      updateData.quietHoursStart = toNullIfEmpty(formData.quietHoursStart)
    }
    if (formData.quietHoursEnd !== (patient.quietHoursEnd || '')) {
      updateData.quietHoursEnd = toNullIfEmpty(formData.quietHoursEnd)
    }
    if (formData.consentSource !== (patient.consentSource || '')) {
      updateData.consentSource = formData.consentSource ? formData.consentSource : null
    }

    // Insurance Summary - only include if changed
    if (formData.primaryInsuranceId !== (patient.primaryInsuranceId || '')) {
      updateData.primaryInsuranceId = toNullIfEmpty(formData.primaryInsuranceId)
    }
    if (formData.secondaryInsuranceId !== (patient.secondaryInsuranceId || '')) {
      updateData.secondaryInsuranceId = toNullIfEmpty(formData.secondaryInsuranceId)
    }
    if (formData.insuranceStatus !== (patient.insuranceStatus || '')) {
      updateData.insuranceStatus = formData.insuranceStatus ? formData.insuranceStatus : null
    }
    if (formData.lastInsuranceVerifiedAt !== formatDateForInput(patient.lastInsuranceVerifiedAt)) {
      updateData.lastInsuranceVerifiedAt = formData.lastInsuranceVerifiedAt ? formData.lastInsuranceVerifiedAt : null
    }
    if (formData.selfPay !== (patient.selfPay ?? false)) {
      updateData.selfPay = formData.selfPay
    }

    // Legacy - only include if changed
    if (formData.notes !== (patient.notes || '')) {
      updateData.notes = toNullIfEmpty(formData.notes)
    }

    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Provide more detailed error messages
        let errorMessage = errorData.error || 'Failed to update patient'
        if (errorData.details) {
          // Handle Zod validation errors
          if (Array.isArray(errorData.details.issues)) {
            const issues = errorData.details.issues.map((issue: any) => {
              const path = issue.path?.join('.') || 'field'
              return `${path}: ${issue.message}`
            }).join(', ')
            errorMessage = `Validation error: ${issues}`
          } else {
            errorMessage = `${errorMessage}: ${JSON.stringify(errorData.details)}`
          }
        }
        throw new Error(errorMessage)
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Edit Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <div className="border-b border-gray-200 pb-4">
              <button
                type="button"
                onClick={() => toggleSection('basicInfo')}
                className="flex items-center justify-between w-full mb-4"
              >
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                {expandedSections.basicInfo ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.basicInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="externalEhrId">External EHR ID</Label>
                    <Input
                      id="externalEhrId"
                      value={formData.externalEhrId}
                      onChange={(e) => setFormData({ ...formData, externalEhrId: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredName">Preferred Name</Label>
                    <Input
                      id="preferredName"
                      value={formData.preferredName}
                      onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name (Legacy) *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information Section */}
            <div className="border-b border-gray-200 pb-4">
              <button
                type="button"
                onClick={() => toggleSection('contactInfo')}
                className="flex items-center justify-between w-full mb-4"
              >
                <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
                {expandedSections.contactInfo ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.contactInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryPhone">Primary Phone *</Label>
                    <Input
                      id="primaryPhone"
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => {
                        const value = e.target.value
                        setFormData({ 
                          ...formData, 
                          primaryPhone: value,
                          // Sync phone field if it's empty
                          phone: formData.phone || value
                        })
                      }}
                      required
                      placeholder="e.g., +1-555-123-4567"
                    />
                    <p className="text-xs text-gray-500">This will also update the legacy phone field</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryPhone">Secondary Phone</Label>
                    <Input
                      id="secondaryPhone"
                      type="tel"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pronouns">Pronouns</Label>
                    <Input
                      id="pronouns"
                      value={formData.pronouns}
                      onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })}
                      placeholder="e.g., he/him, she/her, they/them"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="primaryLanguage">Primary Language</Label>
                    <Input
                      id="primaryLanguage"
                      value={formData.primaryLanguage}
                      onChange={(e) => setFormData({ ...formData, primaryLanguage: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Communication Preferences & Consent Section */}
            <div className="border-b border-gray-200 pb-4">
              <button
                type="button"
                onClick={() => toggleSection('communication')}
                className="flex items-center justify-between w-full mb-4"
              >
                <h3 className="text-lg font-medium text-gray-900">Communication Preferences & Consent</h3>
                {expandedSections.communication ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.communication && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferredChannel">Preferred Channel</Label>
                    <Select
                      value={formData.preferredChannel}
                      onValueChange={(value) => setFormData({ ...formData, preferredChannel: value })}
                    >
                      <SelectTrigger id="preferredChannel">
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredContactMethod">Preferred Contact Method (Legacy)</Label>
                    <Select
                      value={formData.preferredContactMethod}
                      onValueChange={(value) => setFormData({ ...formData, preferredContactMethod: value })}
                    >
                      <SelectTrigger id="preferredContactMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="mail">Mail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="smsOptIn"
                      checked={formData.smsOptIn}
                      onChange={(e) => setFormData({ ...formData, smsOptIn: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="smsOptIn">SMS Opt-In</Label>
                  </div>

                  {formData.smsOptIn && (
                    <div className="space-y-2">
                      <Label htmlFor="smsOptInAt">SMS Opt-In Date</Label>
                      <Input
                        id="smsOptInAt"
                        type="date"
                        value={formData.smsOptInAt}
                        onChange={(e) => setFormData({ ...formData, smsOptInAt: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="emailOptIn"
                      checked={formData.emailOptIn}
                      onChange={(e) => setFormData({ ...formData, emailOptIn: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="emailOptIn">Email Opt-In</Label>
                  </div>

                  <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="voiceOptIn"
                      checked={formData.voiceOptIn}
                      onChange={(e) => setFormData({ ...formData, voiceOptIn: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="voiceOptIn">Voice Opt-In</Label>
                  </div>

                  <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="doNotContact"
                      checked={formData.doNotContact}
                      onChange={(e) => setFormData({ ...formData, doNotContact: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="doNotContact">Do Not Contact</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quietHoursStart">Quiet Hours Start (HH:mm)</Label>
                    <Input
                      id="quietHoursStart"
                      type="time"
                      value={formData.quietHoursStart}
                      onChange={(e) => setFormData({ ...formData, quietHoursStart: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quietHoursEnd">Quiet Hours End (HH:mm)</Label>
                    <Input
                      id="quietHoursEnd"
                      type="time"
                      value={formData.quietHoursEnd}
                      onChange={(e) => setFormData({ ...formData, quietHoursEnd: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="consentSource">Consent Source</Label>
                    <Select
                      value={formData.consentSource}
                      onValueChange={(value) => setFormData({ ...formData, consentSource: value })}
                    >
                      <SelectTrigger id="consentSource">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web">Web</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="import">Import</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Insurance Summary Section */}
            <div className="border-b border-gray-200 pb-4">
              <button
                type="button"
                onClick={() => toggleSection('insurance')}
                className="flex items-center justify-between w-full mb-4"
              >
                <h3 className="text-lg font-medium text-gray-900">Insurance Summary</h3>
                {expandedSections.insurance ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.insurance && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selfPay"
                      checked={formData.selfPay}
                      onChange={(e) => setFormData({ ...formData, selfPay: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="selfPay">Self Pay</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryInsuranceId">Primary Insurance ID</Label>
                    <Input
                      id="primaryInsuranceId"
                      value={formData.primaryInsuranceId}
                      onChange={(e) => setFormData({ ...formData, primaryInsuranceId: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryInsuranceId">Secondary Insurance ID</Label>
                    <Input
                      id="secondaryInsuranceId"
                      value={formData.secondaryInsuranceId}
                      onChange={(e) => setFormData({ ...formData, secondaryInsuranceId: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="insuranceStatus">Insurance Status</Label>
                    <Select
                      value={formData.insuranceStatus}
                      onValueChange={(value) => setFormData({ ...formData, insuranceStatus: value })}
                    >
                      <SelectTrigger id="insuranceStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="self_pay">Self Pay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastInsuranceVerifiedAt">Last Verified Date</Label>
                    <Input
                      id="lastInsuranceVerifiedAt"
                      type="date"
                      value={formData.lastInsuranceVerifiedAt}
                      onChange={(e) => setFormData({ ...formData, lastInsuranceVerifiedAt: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Legacy Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="notes">Legacy Notes</Label>
              <Textarea
                id="notes"
                className="w-full min-h-[100px]"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Enter legacy notes (consider using structured notes instead)"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md flex items-start gap-2">
                <span className="font-medium">Error:</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
