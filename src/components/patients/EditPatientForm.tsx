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
  const formatDateForInput = (date: Date | string | null) => {
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

    // Build update data - include all fields that have been modified
    const updateData: any = {}

    // Legacy fields - ensure name and phone are set
    const displayName = formData.name || (formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}`.trim() : formData.firstName || formData.lastName)
    updateData.name = displayName || toNullIfEmpty(displayName) || ''
    const phoneValue = formData.primaryPhone || formData.phone
    if (phoneValue) {
      updateData.phone = phoneValue
      updateData.primaryPhone = formData.primaryPhone || phoneValue
    }
    updateData.preferredContactMethod = formData.preferredContactMethod

    // Basic Information
    updateData.externalEhrId = toNullIfEmpty(formData.externalEhrId)
    updateData.firstName = toNullIfEmpty(formData.firstName)
    updateData.lastName = toNullIfEmpty(formData.lastName)
    updateData.preferredName = toNullIfEmpty(formData.preferredName)
    updateData.dateOfBirth = formData.dateOfBirth ? formData.dateOfBirth : null

    // Contact Information
    updateData.primaryPhone = toNullIfEmpty(formData.primaryPhone) || phoneValue || null
    updateData.secondaryPhone = toNullIfEmpty(formData.secondaryPhone)
    updateData.email = toNullIfEmpty(formData.email)
    updateData.addressLine1 = toNullIfEmpty(formData.addressLine1)
    updateData.addressLine2 = toNullIfEmpty(formData.addressLine2)
    updateData.city = toNullIfEmpty(formData.city)
    updateData.state = toNullIfEmpty(formData.state)
    updateData.postalCode = toNullIfEmpty(formData.postalCode)
    updateData.gender = formData.gender ? formData.gender : null
    updateData.pronouns = toNullIfEmpty(formData.pronouns)
    updateData.primaryLanguage = toNullIfEmpty(formData.primaryLanguage)

    // Communication Preferences & Consent
    updateData.preferredChannel = formData.preferredChannel ? formData.preferredChannel : null
    updateData.smsOptIn = formData.smsOptIn
    updateData.smsOptInAt = formData.smsOptInAt ? formData.smsOptInAt : null
    updateData.emailOptIn = formData.emailOptIn
    updateData.voiceOptIn = formData.voiceOptIn
    updateData.doNotContact = formData.doNotContact
    updateData.quietHoursStart = toNullIfEmpty(formData.quietHoursStart)
    updateData.quietHoursEnd = toNullIfEmpty(formData.quietHoursEnd)
    updateData.consentSource = formData.consentSource ? formData.consentSource : null

    // Insurance Summary
    updateData.primaryInsuranceId = toNullIfEmpty(formData.primaryInsuranceId)
    updateData.secondaryInsuranceId = toNullIfEmpty(formData.secondaryInsuranceId)
    updateData.insuranceStatus = formData.insuranceStatus ? formData.insuranceStatus : null
    updateData.lastInsuranceVerifiedAt = formData.lastInsuranceVerifiedAt ? formData.lastInsuranceVerifiedAt : null
    updateData.selfPay = formData.selfPay

    // Legacy
    updateData.notes = toNullIfEmpty(formData.notes)

    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update patient')
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
                      onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                      required
                    />
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
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
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
