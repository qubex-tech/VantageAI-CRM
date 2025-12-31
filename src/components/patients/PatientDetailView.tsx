'use client'

import { useState } from 'react'
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
  MessageSquare,
  Plus
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { EditPatientForm } from './EditPatientForm'

interface PatientDetailViewProps {
  patient: {
    id: string
    name: string
    dateOfBirth: Date
    phone: string
    email: string | null
    address: string | null
    preferredContactMethod: string
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
  }
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

export function PatientDetailView({ patient }: PatientDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'appointments' | 'calls'>('overview')
  const [sidebarTab, setSidebarTab] = useState<'details' | 'comments'>('details')
  const [isEditing, setIsEditing] = useState(false)
  
  const age = calculateAge(patient.dateOfBirth)
  const upcomingAppointments = patient.appointments.filter(apt => new Date(apt.startTime) > new Date())
  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null

  if (isEditing) {
    return <EditPatientForm patient={patient} onCancel={() => setIsEditing(false)} />
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">{patient.name}</h1>
              <Star className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Mail className="h-4 w-4" />
              Compose email
            </Button>
            <Button variant="ghost" size="icon">
              <Clipboard className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <CheckSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Send className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-gray-300 ml-2"></div>
          </div>
        </div>

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
              Appointments {patient.appointments.length > 0 && `(${patient.appointments.length})`}
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
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl">
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
                      <div className="text-sm font-medium text-gray-900">{patient.phone}</div>
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

            {/* Activity Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-medium text-gray-900">Activity</h2>
                </div>
                <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
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
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
        {/* Sidebar Header Tabs */}
        <div className="border-b border-gray-200 px-4">
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
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {sidebarTab === 'details' && (
            <div className="space-y-6">
              {/* Record Details Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Record Details</h3>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <User className="h-3 w-3" />
                      Name
                    </div>
                    <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <MailIcon className="h-3 w-3" />
                      Email addresses
                    </div>
                    <div className="text-sm font-medium text-blue-600">
                      {patient.email || 'No email'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <PhoneIcon className="h-3 w-3" />
                      Phone
                    </div>
                    <div className="text-sm font-medium text-gray-900">{patient.phone}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Calendar className="h-3 w-3" />
                      Date of Birth
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {format(new Date(patient.dateOfBirth), 'MMM d, yyyy')}
                    </div>
                  </div>

                  {patient.address && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <MapPin className="h-3 w-3" />
                        Address
                      </div>
                      <div className="text-sm font-medium text-gray-900">{patient.address}</div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <PhoneIcon className="h-3 w-3" />
                      Preferred Contact
                    </div>
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {patient.preferredContactMethod}
                    </div>
                  </div>

                  {patient.tags.length > 0 && (
                    <div>
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

                  <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-4">
                    Show all values
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notes Section */}
              {patient.notes && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900">Notes</h3>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {patient.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {sidebarTab === 'comments' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No comments yet
            </div>
          )}
        </div>

        {/* Edit Button */}
        <div className="border-t border-gray-200 p-4">
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="w-full"
          >
            Edit Patient
          </Button>
        </div>
      </div>
    </div>
  )
}
