import { redirect } from 'next/navigation'
import { getPatientSession } from '@/lib/portal-session'
import { prisma } from '@/lib/db'
import { format } from 'date-fns'
import Link from 'next/link'
import { BackButton } from '@/components/portal/BackButton'
import { PreferencesForm } from './preferences-form'
import { Label } from '@/components/ui/label'

/**
 * Portal Profile and Preferences Page
 * Shows patient profile information, consent records, and communication preferences
 */
export default async function PortalPreferencesPage() {
  const session = await getPatientSession()
  
  if (!session) {
    redirect('/portal/auth')
  }
  
  // Get patient information
  const patient = await prisma.patient.findUnique({
    where: {
      id: session.patientId,
      practiceId: session.practiceId,
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      dateOfBirth: true,
      email: true,
      phone: true,
      primaryPhone: true,
      secondaryPhone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      address: true, // Legacy field
      gender: true,
      preferredContactMethod: true,
      practice: {
        select: {
          name: true,
        },
      },
    },
  })
  
  if (!patient) {
    redirect('/portal/auth')
  }
  
  // Get communication preferences
  const preferences = await prisma.communicationPreference.findUnique({
    where: {
      patientId: session.patientId,
    },
  })
  
  // Get consent records
  const consentRecords = await prisma.consentRecord.findMany({
    where: {
      practiceId: session.practiceId,
      patientId: session.patientId,
    },
    orderBy: { createdAt: 'desc' },
  })
  
  const getConsentLabel = (type: string) => {
    switch (type) {
      case 'marketing': return 'Marketing Communications'
      case 'sms': return 'SMS Messages'
      case 'email': return 'Email Communications'
      case 'portal': return 'Portal Access'
      case 'data_sharing': return 'Data Sharing'
      default: return type
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="mb-4">
            <BackButton />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Profile and Preferences</h1>
          <p className="text-gray-600 mt-2">View your profile information and manage your communication preferences</p>
        </div>
        
        <div className="space-y-6">
          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                <p className="mt-1 text-gray-900">
                  {patient.preferredName || 
                   (patient.firstName && patient.lastName 
                     ? `${patient.firstName} ${patient.lastName}` 
                     : patient.name || 'Not provided')}
                </p>
                {patient.preferredName && patient.firstName && patient.lastName && (
                  <p className="mt-1 text-sm text-gray-500">
                    Legal name: {patient.firstName} {patient.lastName}
                  </p>
                )}
              </div>
              
              {/* Date of Birth */}
              {patient.dateOfBirth && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(patient.dateOfBirth), 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
              
              {/* Email */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                <p className="mt-1 text-gray-900">
                  {patient.email || 'Not provided'}
                </p>
              </div>
              
              {/* Primary Phone */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Primary Phone</Label>
                <p className="mt-1 text-gray-900">
                  {patient.primaryPhone || patient.phone || 'Not provided'}
                </p>
              </div>
              
              {/* Secondary Phone */}
              {patient.secondaryPhone && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Secondary Phone</Label>
                  <p className="mt-1 text-gray-900">
                    {patient.secondaryPhone}
                  </p>
                </div>
              )}
              
              {/* Gender */}
              {patient.gender && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Gender</Label>
                  <p className="mt-1 text-gray-900 capitalize">
                    {patient.gender}
                  </p>
                </div>
              )}
              
              {/* Address */}
              {(patient.addressLine1 || patient.address) && (
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Address</Label>
                  <p className="mt-1 text-gray-900">
                    {patient.addressLine1 || patient.address}
                    {patient.addressLine2 && `, ${patient.addressLine2}`}
                    {patient.city && `, ${patient.city}`}
                    {patient.state && `, ${patient.state}`}
                    {patient.postalCode && ` ${patient.postalCode}`}
                  </p>
                </div>
              )}
              
              {/* Practice */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Practice</Label>
                <p className="mt-1 text-gray-900">
                  {patient.practice.name}
                </p>
              </div>
              
              {/* Preferred Contact Method */}
              {patient.preferredContactMethod && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Preferred Contact Method</Label>
                  <p className="mt-1 text-gray-900 capitalize">
                    {patient.preferredContactMethod}
                  </p>
                </div>
              )}
            </div>
            
            <p className="mt-4 text-xs text-gray-500">
              To update your profile information, please contact your practice directly.
            </p>
          </div>
          
          {/* Communication Preferences */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Communication Preferences</h2>
            
            <PreferencesForm initialPreferences={preferences} />
          </div>
          
          {/* Consent Records */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Consent History</h2>
            
            {consentRecords.length === 0 ? (
              <p className="text-gray-500">No consent records</p>
            ) : (
              <div className="space-y-3">
                {consentRecords.map((consent) => (
                  <div key={consent.id} className="border-b border-gray-200 pb-3 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {getConsentLabel(consent.consentType)}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>
                            {format(new Date(consent.createdAt), 'MMM d, yyyy h:mm a')}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{consent.method}</span>
                          {consent.revokedAt && (
                            <>
                              <span>•</span>
                              <span className="text-red-600">
                                Revoked {format(new Date(consent.revokedAt), 'MMM d, yyyy')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        consent.consented && !consent.revokedAt
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {consent.consented && !consent.revokedAt ? 'Consented' : 'Not Consented'}
                      </span>
                    </div>
                    {consent.expiresAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expires: {format(new Date(consent.expiresAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
