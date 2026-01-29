'use client'

import { useState, useEffect } from 'react'
import { ComposeEmail } from './ComposeEmail'
import { ComposeSms } from './ComposeSms'
import { PatientNotes } from './PatientNotes'
import { useHealixOpen } from '@/components/healix/HealixButton'
import Link from 'next/link'
import { 
  Star, 
  Mail, 
  Clipboard, 
  FileText, 
  Share2, 
  CheckSquare, 
  Send,
  Bell,
  HelpCircle,
  User,
  Activity,
  Calendar,
  Phone,
  MapPin,
  Building2,
  ChevronRight,
  Grid,
  Clock,
  Heart,
  AtSign,
  Phone as PhoneIcon,
  Mail as MailIcon,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Plus,
  Shield,
  Globe,
  Pencil
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditPatientForm } from './EditPatientForm'
import { PatientTasks } from '@/components/tasks/PatientTasks'
import { cn } from '@/lib/utils'

interface PatientDetailViewProps {
  patient: {
    id: string
    name: string
    // Basic Information
    externalEhrId?: string | null
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
    dateOfBirth: Date | null
    // Contact Information
    primaryPhone?: string | null
    secondaryPhone?: string | null
    phone: string
    email: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    address: string | null
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
    createdAt: Date
    updatedAt: Date
    tags: Array<{ id: string; tag: string }>
    insurancePolicies: Array<any>
    appointments: Array<{
      id: string
      startTime: Date
      endTime: Date
      visitType: string
      status: string
    }>
    timelineEntries: Array<{
      id: string
      type: string
      title: string
      description: string | null
      createdAt: Date
      metadata: any
    }>
    formSubmissions?: Array<{
      id: string
      formType: string
      status: string
      submittedAt: Date
      formData: any
      template?: { id: string; name: string; category: string } | null
      request?: { id: string } | null
    }>
  }
  users?: Array<{ id: string; name: string; email: string }>
  currentUserId?: string
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

interface PatientNote {
  id: string
  type: string
  content: string
  createdAt: string | Date // API returns as string (JSON), but can be Date object
  updatedAt: string | Date
  user: {
    id: string
    name: string
    email: string
  }
}

export function PatientDetailView({ patient, users = [], currentUserId = '' }: PatientDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'appointments' | 'calls'>('overview')
  const [sidebarTab, setSidebarTab] = useState<'details' | 'comments'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [composeEmailOpen, setComposeEmailOpen] = useState(false)
  const [composeSmsOpen, setComposeSmsOpen] = useState(false)
  const [portalInviteState, setPortalInviteState] = useState<{
    status: 'idle' | 'sending' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })
  const [notesOpen, setNotesOpen] = useState(false)
  const [patientNotes, setPatientNotes] = useState<PatientNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const healixOpen = useHealixOpen()
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basicInfo: false,
    contactInfo: false,
    communication: false,
    insurance: false,
    tasks: false,
    formSubmissions: true,
    notes: true, // Expand notes section by default
  })
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const sendPortalInvite = async (channel: 'email' | 'sms' | 'auto' = 'auto') => {
    setPortalInviteState({ status: 'sending' })
    try {
      const res = await fetch(`/api/patients/${patient.id}/portal-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send portal invite')
      }
      setPortalInviteState({
        status: 'success',
        message: `Secure portal invite sent via ${data.channel} to ${data.sentTo}.`,
      })
    } catch (e) {
      setPortalInviteState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to send portal invite',
      })
    } finally {
      window.setTimeout(() => setPortalInviteState({ status: 'idle' }), 6000)
    }
  }
  
  // Fetch structured notes
  useEffect(() => {
    const fetchNotes = async () => {
      setNotesLoading(true)
      try {
        const response = await fetch(`/api/patients/${patient.id}/notes`)
        if (response.ok) {
          const data = await response.json()
          setPatientNotes(data.notes || [])
        }
      } catch (error) {
        console.error('Error fetching patient notes:', error)
      } finally {
        setNotesLoading(false)
      }
    }
    
    fetchNotes()
  }, [patient.id])
  
  // Refresh notes when dialog closes (after note is added/edited/deleted)
  const handleNotesChange = () => {
    const fetchNotes = async () => {
      setNotesLoading(true)
      try {
        const response = await fetch(`/api/patients/${patient.id}/notes`)
        if (response.ok) {
          const data = await response.json()
          setPatientNotes(data.notes || [])
        }
      } catch (error) {
        console.error('Error fetching patient notes:', error)
      } finally {
        setNotesLoading(false)
      }
    }
    fetchNotes()
  }
  
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : 0
  
  // Helper to get display name
  const getDisplayName = () => {
    if (patient.firstName || patient.lastName) {
      return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.name
    }
    return patient.name
  }
  
  // Helper to format time
  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return null
    try {
      const [hours, minutes] = timeStr.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return timeStr
    }
  }
  
  // Debug: Log appointments to see what we're getting
  console.log('[PatientDetailView] Patient appointments:', patient.appointments)
  console.log('[PatientDetailView] Appointments count:', patient.appointments?.length || 0)
  
  // Ensure appointments is always an array
  const appointments = Array.isArray(patient.appointments) ? patient.appointments : []
  const formSubmissions = Array.isArray(patient.formSubmissions) ? patient.formSubmissions : []
  const upcomingAppointments = appointments.filter(apt => {
    try {
      const aptDate = new Date(apt.startTime)
      return aptDate > new Date()
    } catch (e) {
      console.error('[PatientDetailView] Error parsing appointment date:', e, apt)
      return false
    }
  })
  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null

  if (isEditing) {
    return (
      <EditPatientForm
        patient={patient}
        onCancel={() => setIsEditing(false)}
        onSuccess={() => {
          setIsEditing(false)
          window.location.reload() // Force full refresh to get updated patient data
        }}
      />
    )
  }

  return (
    <div className={cn(
      "flex h-screen bg-white min-w-0 w-full",
      // Width is now controlled by CSS custom properties via main-content-healix class
    )}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 max-w-full">
        {/* Header Bar */}
        <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between bg-white min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 truncate">{patient.name}</h1>
              <Star className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <Button variant="ghost" size="icon">
              <Clipboard className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSidebarTab('details')
                setExpandedSections((prev) => ({ ...prev, formSubmissions: true }))
              }}
              aria-label="Form submissions"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <CheckSquare className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Send message</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setComposeEmailOpen(true)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setComposeSmsOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  SMS
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={portalInviteState.status === 'sending'}>
                    <Shield className="mr-2 h-4 w-4" />
                    {portalInviteState.status === 'sending' ? 'Sending portal invite…' : 'Portal invite'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => sendPortalInvite('email')}>
                      <Mail className="mr-2 h-4 w-4" />
                      Send via Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => sendPortalInvite('sms')}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send via SMS
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-gray-300 ml-2"></div>
          </div>
        </div>

        {portalInviteState.status !== 'idle' && portalInviteState.message && (
          <div
            className={cn(
              'px-6 py-2 text-sm border-b',
              portalInviteState.status === 'success' && 'bg-green-50 text-green-800 border-green-200',
              portalInviteState.status === 'error' && 'bg-red-50 text-red-800 border-red-200',
              portalInviteState.status === 'sending' && 'bg-gray-50 text-gray-700 border-gray-200'
            )}
          >
            {portalInviteState.message}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 px-6 bg-white">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="h-4 w-4" />
              Activity {patient.timelineEntries.length > 0 && `(${patient.timelineEntries.length})`}
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'appointments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Appointments {appointments.length > 0 && `(${appointments.length})`}
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'calls'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PhoneIcon className="h-4 w-4" />
              Calls (0)
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-w-0">
          <div className="max-w-4xl w-full min-w-0 mx-auto">
            {activeTab === 'overview' && (
              <>
                {/* Highlights Section */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Grid className="h-4 w-4 text-gray-500" />
                      <h2 className="text-sm font-medium text-gray-900">Highlights</h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Age */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Age</div>
                          <div className="text-sm font-medium text-gray-900">{age} years</div>
                        </div>
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Next Appointment */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Next appointment</div>
                          <div className="text-sm font-medium text-gray-900">
                            {nextAppointment 
                              ? format(new Date(nextAppointment.startTime), 'MMM d, yyyy h:mm a')
                              : 'No upcoming appointments'
                            }
                          </div>
                        </div>
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-1">Email addresses</div>
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {patient.email || 'No email address'}
                          </div>
                        </div>
                        <AtSign className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Phone numbers</div>
                          <div className="text-sm font-medium text-gray-900">{patient.primaryPhone || patient.phone}</div>
                        </div>
                        <PhoneIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-1">Primary location</div>
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {patient.address || 'No address'}
                          </div>
                        </div>
                        <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    {/* Insurance */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Insurance policies</div>
                          <div className="text-sm font-medium text-gray-900">
                            {patient.insurancePolicies.length > 0 
                              ? `${patient.insurancePolicies.length} policy${patient.insurancePolicies.length > 1 ? 'ies' : ''}`
                              : 'No insurance policies'
                            }
                          </div>
                        </div>
                        <Building2 className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Section Preview */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <h2 className="text-sm font-medium text-gray-900">Activity</h2>
                    </div>
                    <button 
                      onClick={() => setActiveTab('activity')}
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      View all
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {patient.timelineEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Activity className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{entry.title}</div>
                            {entry.description && (
                              <div className="text-sm text-gray-500 mt-1">{entry.description}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-2">
                              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {patient.timelineEntries.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        No activity recorded
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'activity' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Activity</h2>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add meeting
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {patient.timelineEntries.length > 0 ? (
                    // Group activities by date
                    (() => {
                      const grouped: { [key: string]: typeof patient.timelineEntries } = {}
                      const now = new Date()
                      const today = new Date(now.setHours(0, 0, 0, 0))
                      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                      
                      patient.timelineEntries.forEach((entry) => {
                        const entryDate = new Date(entry.createdAt)
                        let groupKey = ''
                        
                        if (entryDate >= today) {
                          groupKey = 'Today'
                        } else if (entryDate >= thisWeek) {
                          groupKey = 'This week'
                        } else {
                          const monthYear = format(entryDate, 'MMMM yyyy')
                          groupKey = monthYear
                        }
                        
                        if (!grouped[groupKey]) {
                          grouped[groupKey] = []
                        }
                        grouped[groupKey].push(entry)
                      })
                      
                      return Object.entries(grouped).map(([groupKey, entries]) => (
                        <div key={groupKey}>
                          <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-sm font-medium text-gray-900">{groupKey}</h3>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="space-y-4">
                            {entries.map((entry) => (
                              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                                <div className="flex items-start gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <Activity className="h-4 w-4 text-gray-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900">{entry.title}</div>
                                    {entry.description && (
                                      <div className="text-sm text-gray-500 mt-1">{entry.description}</div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-2">
                                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-sm">
                      No activity recorded
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'appointments' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
                  <Link href={`/appointments/new?patientId=${patient.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Schedule Appointment
                    </Button>
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {appointments.length > 0 ? (
                    (() => {
                      const grouped: { [key: string]: typeof appointments } = {}
                      const now = new Date()
                      const today = new Date(now)
                      today.setHours(0, 0, 0, 0)
                      const thisWeekStart = new Date(today)
                      thisWeekStart.setDate(today.getDate() - 7)
                      
                      // Sort appointments by startTime (ascending for upcoming, descending for past)
                      const sortedAppointments = [...appointments].sort((a, b) => {
                        const aTime = new Date(a.startTime).getTime()
                        const bTime = new Date(b.startTime).getTime()
                        return aTime - bTime // Sort ascending
                      })
                      
                      sortedAppointments.forEach((appointment) => {
                        const aptDate = new Date(appointment.startTime)
                        aptDate.setHours(0, 0, 0, 0)
                        let groupKey = ''
                        
                        if (aptDate >= today) {
                          groupKey = 'Upcoming'
                        } else if (aptDate >= thisWeekStart) {
                          groupKey = 'This week'
                        } else {
                          const monthYear = format(new Date(appointment.startTime), 'MMMM yyyy')
                          groupKey = monthYear
                        }
                        
                        if (!grouped[groupKey]) {
                          grouped[groupKey] = []
                        }
                        grouped[groupKey].push(appointment)
                      })
                      
                      // Sort groups: Upcoming first, then This week, then months (newest first)
                      const groupOrder = ['Upcoming', 'This week']
                      const sortedGroups = Object.entries(grouped).sort(([keyA], [keyB]) => {
                        if (groupOrder.includes(keyA) && groupOrder.includes(keyB)) {
                          return groupOrder.indexOf(keyA) - groupOrder.indexOf(keyB)
                        }
                        if (groupOrder.includes(keyA)) return -1
                        if (groupOrder.includes(keyB)) return 1
                        // For months, sort newest first (we'll need to parse the month names)
                        return keyB.localeCompare(keyA)
                      })
                      
                      return sortedGroups.map(([groupKey, appointments]) => (
                        <div key={groupKey}>
                          <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-sm font-medium text-gray-900">{groupKey}</h3>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="space-y-4">
                            {appointments.sort((a, b) => {
                              const aTime = new Date(a.startTime).getTime()
                              const bTime = new Date(b.startTime).getTime()
                              return groupKey === 'Upcoming' ? aTime - bTime : bTime - aTime
                            }).map((appointment) => (
                              <Link
                                key={appointment.id}
                                href={`/appointments/${appointment.id}`}
                                className="block border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900">{appointment.visitType}</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                      {format(new Date(appointment.startTime), 'MMM d, yyyy h:mm a')} - {format(new Date(appointment.endTime), 'h:mm a')}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                        appointment.status === 'confirmed' || appointment.status === 'scheduled'
                                          ? 'bg-green-100 text-green-700'
                                          : appointment.status === 'cancelled'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {appointment.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))
                    })()
                  ) : (
                    <div className="text-center py-12 text-gray-500 text-sm">
                      No appointments scheduled
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'calls' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Calls</h2>
                </div>
                <div className="text-center py-12 text-gray-500 text-sm">
                  No calls recorded
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Adjust width when Healix is open to prevent cutoff */}
      <div className={cn(
        "border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0 transition-all duration-300",
        // Default width
        "w-80",
        // When Healix is open on desktop: reduce width significantly to fit
        // Healix panel takes 384px (md) or 420px (lg), so reduce sidebar proportionally
        healixOpen && "md:w-56 lg:w-64"
      )}>
        {/* Sidebar Header Tabs */}
        <div className="border-b border-gray-200 px-4 flex-shrink-0">
          <div className="flex gap-4">
            <button
              onClick={() => setSidebarTab('details')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                sidebarTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setSidebarTab('comments')}
              className={`px-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                sidebarTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Comments 0
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 min-w-0">
          {sidebarTab === 'details' && (
            <div className="space-y-4">
              {/* Basic Information Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <button
                    onClick={() => toggleSection('basicInfo')}
                    className="flex items-center justify-between flex-1 min-w-0"
                  >
                    <h3 className="text-sm font-medium text-gray-900">Basic Information</h3>
                    {expandedSections.basicInfo ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 flex-shrink-0"
                    title="Edit Patient"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                
                {expandedSections.basicInfo && (
                  <div className="space-y-3 min-w-0">
                    {patient.externalEhrId && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">External EHR ID</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.externalEhrId}</div>
                      </div>
                    )}
                    {(patient.firstName || patient.lastName) && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">First Name</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.firstName || '—'}</div>
                      </div>
                    )}
                    {(patient.firstName || patient.lastName) && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Last Name</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.lastName || '—'}</div>
                      </div>
                    )}
                    {patient.preferredName && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Preferred Name</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.preferredName}</div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Display Name</div>
                      <div className="text-sm font-medium text-gray-900 break-words">{getDisplayName()}</div>
                    </div>
                    {patient.dateOfBirth && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Date of Birth</div>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {format(new Date(patient.dateOfBirth), 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Information Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('contactInfo')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900">Contact Information</h3>
                  {expandedSections.contactInfo ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.contactInfo && (
                  <div className="space-y-3 min-w-0">
                    {(patient.primaryPhone || patient.phone) && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <PhoneIcon className="h-3 w-3 flex-shrink-0" />
                          Primary Phone
                        </div>
                        <div className="text-sm font-medium text-gray-900 break-all">
                          {patient.primaryPhone || patient.phone}
                        </div>
                      </div>
                    )}
                    {patient.secondaryPhone && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <PhoneIcon className="h-3 w-3 flex-shrink-0" />
                          Secondary Phone
                        </div>
                        <div className="text-sm font-medium text-gray-900 break-all">{patient.secondaryPhone}</div>
                      </div>
                    )}
                    {(patient.email || patient.addressLine1 || patient.address) && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <MailIcon className="h-3 w-3 flex-shrink-0" />
                          Email
                        </div>
                        <div className="text-sm font-medium text-blue-600 break-all min-w-0">
                          {patient.email || 'No email'}
                        </div>
                      </div>
                    )}
                    {(patient.addressLine1 || patient.address) && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          Address
                        </div>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {patient.addressLine1 || patient.address || '—'}
                          {patient.addressLine2 && `, ${patient.addressLine2}`}
                          {patient.city && `, ${patient.city}`}
                          {patient.state && `, ${patient.state}`}
                          {patient.postalCode && ` ${patient.postalCode}`}
                        </div>
                      </div>
                    )}
                    {patient.gender && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Gender</div>
                        <div className="text-sm font-medium text-gray-900 capitalize break-words">{patient.gender}</div>
                      </div>
                    )}
                    {patient.pronouns && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Pronouns</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.pronouns}</div>
                      </div>
                    )}
                    {patient.primaryLanguage && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Primary Language</div>
                        <div className="text-sm font-medium text-gray-900 break-words">{patient.primaryLanguage}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Communication Preferences & Consent Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('communication')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900">Communication Preferences & Consent</h3>
                  {expandedSections.communication ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.communication && (
                  <div className="space-y-3 min-w-0">
                    {(patient.preferredChannel || patient.preferredContactMethod) && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Preferred Channel</div>
                        <div className="text-sm font-medium text-gray-900 capitalize break-words">
                          {patient.preferredChannel || patient.preferredContactMethod}
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">SMS Opt-In</div>
                      <div className="text-sm font-medium text-gray-900">
                        {patient.smsOptIn ? 'Yes' : 'No'}
                        {patient.smsOptInAt && ` (${format(new Date(patient.smsOptInAt), 'MMM d, yyyy')})`}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Email Opt-In</div>
                      <div className="text-sm font-medium text-gray-900">{patient.emailOptIn ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Voice Opt-In</div>
                      <div className="text-sm font-medium text-gray-900">{patient.voiceOptIn ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Do Not Contact</div>
                      <div className="text-sm font-medium text-gray-900">{patient.doNotContact ? 'Yes' : 'No'}</div>
                    </div>
                    {(patient.quietHoursStart || patient.quietHoursEnd) && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Quiet Hours</div>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {formatTime(patient.quietHoursStart) || '—'} - {formatTime(patient.quietHoursEnd) || '—'}
                        </div>
                      </div>
                    )}
                    {patient.consentSource && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Consent Source</div>
                        <div className="text-sm font-medium text-gray-900 capitalize break-words">{patient.consentSource}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Insurance Summary Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('insurance')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900">Insurance Summary</h3>
                  {expandedSections.insurance ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.insurance && (
                  <div className="space-y-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 mb-1">Self Pay</div>
                      <div className="text-sm font-medium text-gray-900">{patient.selfPay ? 'Yes' : 'No'}</div>
                    </div>
                    {patient.primaryInsuranceId && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Primary Insurance ID</div>
                        <div className="text-sm font-medium text-gray-900 break-all">{patient.primaryInsuranceId}</div>
                      </div>
                    )}
                    {patient.secondaryInsuranceId && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Secondary Insurance ID</div>
                        <div className="text-sm font-medium text-gray-900 break-all">{patient.secondaryInsuranceId}</div>
                      </div>
                    )}
                    {patient.insuranceStatus && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Insurance Status</div>
                        <div className="text-sm font-medium text-gray-900 capitalize break-words">
                          {patient.insuranceStatus.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )}
                    {patient.lastInsuranceVerifiedAt && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Last Verified</div>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {format(new Date(patient.lastInsuranceVerifiedAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    )}
                    {patient.insurancePolicies.length > 0 && (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-1">Policies</div>
                        <div className="text-sm font-medium text-gray-900">
                          {patient.insurancePolicies.length} policy{patient.insurancePolicies.length !== 1 ? 'ies' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tags Section */}
              {patient.tags.length > 0 && (
                <div className="min-w-0 border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {patient.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('tasks')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Tasks
                  </h3>
                  {expandedSections.tasks ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSections.tasks && (
                  <PatientTasks
                    patientId={patient.id}
                    users={users}
                    currentUserId={currentUserId}
                  />
                )}
              </div>

              {/* Form Submissions Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('formSubmissions')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Form Submissions
                  </h3>
                  {expandedSections.formSubmissions ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {expandedSections.formSubmissions && (
                  <div className="space-y-3 min-w-0">
                    {formSubmissions.length === 0 ? (
                      <div className="text-sm text-gray-500 italic py-2">
                        No form submissions yet.
                      </div>
                    ) : (
                      formSubmissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="border border-gray-200 rounded-md p-3 bg-gray-50 min-w-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 break-words">
                                {submission.template?.name || submission.formType.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Submitted {format(new Date(submission.submittedAt), 'MMM d, yyyy')}
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 capitalize">
                              {submission.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div className="min-w-0 border-b border-gray-200 pb-4">
                <button
                  onClick={() => toggleSection('notes')}
                  className="flex items-center justify-between w-full mb-3"
                >
                  <h3 className="text-sm font-medium text-gray-900">Notes</h3>
                  <div className="flex items-center gap-2">
                    {patientNotes.length > 0 && (
                      <span className="text-xs text-gray-500">({patientNotes.length})</span>
                    )}
                    {expandedSections.notes ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
                
                {expandedSections.notes && (
                  <div className="space-y-3 min-w-0">
                    {notesLoading ? (
                      <div className="text-sm text-gray-500 py-2">Loading notes...</div>
                    ) : patientNotes.length > 0 ? (
                      <>
                        {/* Show up to 3 most recent notes in sidebar */}
                        {patientNotes.slice(0, 3).map((note) => (
                          <div
                            key={note.id}
                            className="border border-gray-200 rounded-md p-3 bg-gray-50 min-w-0"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                note.type === 'medical' ? 'bg-red-100 text-red-800' :
                                note.type === 'contact' ? 'bg-cyan-100 text-cyan-800' :
                                note.type === 'administrative' ? 'bg-blue-100 text-blue-800' :
                                note.type === 'billing' ? 'bg-yellow-100 text-yellow-800' :
                                note.type === 'appointment' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {note.type.charAt(0).toUpperCase() + note.type.slice(1)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {format(new Date(note.createdAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words min-w-0 line-clamp-2">
                              {note.content}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              By {note.user.name}
                            </p>
                          </div>
                        ))}
                        {patientNotes.length > 3 && (
                          <div className="text-xs text-gray-500 text-center pt-1">
                            +{patientNotes.length - 3} more note{patientNotes.length - 3 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 italic py-2">
                        No structured notes. Use "Manage Notes" to add notes.
                      </div>
                    )}
                    
                    {/* Legacy notes display (if exists) */}
                    {patient.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-1">Legacy Note</div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words min-w-0">
                          {patient.notes}
                        </div>
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotesOpen(true)}
                      className="w-full mt-3"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {patientNotes.length > 0 ? 'View All Notes' : 'Manage Notes'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {sidebarTab === 'comments' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No comments yet
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Dialog */}
      <ComposeEmail
        open={composeEmailOpen}
        onOpenChange={setComposeEmailOpen}
        patientEmail={patient.email || undefined}
        patientName={patient.name}
        patientId={patient.id}
      />

      {/* Compose SMS Dialog */}
      <ComposeSms
        open={composeSmsOpen}
        onOpenChange={setComposeSmsOpen}
        patientPhone={patient.primaryPhone || patient.phone || undefined}
        patientName={patient.name}
        patientId={patient.id}
      />

      {/* Patient Notes Dialog */}
      <PatientNotes
        open={notesOpen}
        onOpenChange={setNotesOpen}
        patientId={patient.id}
        onNoteChange={handleNotesChange}
      />
    </div>
  )
}
