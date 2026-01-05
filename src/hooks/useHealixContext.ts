'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export interface HealixContextPayload {
  route: string
  screenTitle?: string
  patientId?: string
  appointmentId?: string
  invoiceId?: string
  visibleFields?: Record<string, any>
  timelineEvents?: Array<{
    type: string
    title: string
    description?: string
    createdAt: string
  }>
  patientSummary?: any // Pre-fetched patient summary
  appointmentSummary?: any // Pre-fetched appointment summary
}

export interface UseHealixContextOptions {
  patientId?: string
  appointmentId?: string
  invoiceId?: string
  screenTitle?: string
  visibleFields?: Record<string, any>
}

/**
 * Hook to collect page context for Healix
 * 
 * Usage:
 * ```tsx
 * const context = useHealixContext({
 *   patientId: patient?.id,
 *   screenTitle: 'Patient Details',
 *   visibleFields: { name: patient?.name, phone: patient?.phone }
 * })
 * ```
 */
export function useHealixContext(options: UseHealixContextOptions = {}) {
  const pathname = usePathname()
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const [patientSummary, setPatientSummary] = useState<any>(null)
  const [appointmentSummary, setAppointmentSummary] = useState<any>(null)

  // Fetch timeline events if patientId is provided
  useEffect(() => {
    if (options.patientId) {
      fetchTimelineEvents(options.patientId).then(setTimelineEvents).catch(console.error)
    } else {
      setTimelineEvents([])
    }
  }, [options.patientId])

  // Pre-fetch patient summary when on a patient page
  useEffect(() => {
    if (options.patientId) {
      fetchPatientSummary(options.patientId)
        .then(setPatientSummary)
        .catch(err => {
          console.error('Failed to pre-fetch patient summary:', err)
          setPatientSummary(null)
        })
    } else {
      setPatientSummary(null)
    }
  }, [options.patientId])

  // Pre-fetch appointment summary when on an appointment page
  useEffect(() => {
    if (options.appointmentId) {
      fetchAppointmentSummary(options.appointmentId)
        .then(setAppointmentSummary)
        .catch(err => {
          console.error('Failed to pre-fetch appointment summary:', err)
          setAppointmentSummary(null)
        })
    } else {
      setAppointmentSummary(null)
    }
  }, [options.appointmentId])

  const getContext = useCallback((): HealixContextPayload => {
    return {
      route: pathname,
      screenTitle: options.screenTitle,
      patientId: options.patientId,
      appointmentId: options.appointmentId,
      invoiceId: options.invoiceId,
      visibleFields: options.visibleFields,
      timelineEvents: timelineEvents.slice(0, 20), // Limit to last 20 events
      patientSummary: patientSummary, // Include pre-fetched summary
      appointmentSummary: appointmentSummary, // Include pre-fetched summary
    }
  }, [pathname, options, timelineEvents, patientSummary, appointmentSummary])

  return {
    context: getContext(),
    refreshTimeline: useCallback(() => {
      if (options.patientId) {
        fetchTimelineEvents(options.patientId).then(setTimelineEvents).catch(console.error)
      }
    }, [options.patientId]),
  }
}

/**
 * Fetch timeline events for a patient
 */
async function fetchTimelineEvents(patientId: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/patients/${patientId}/timeline`)
    if (!response.ok) {
      return []
    }
    const data = await response.json()
    return data.events || []
  } catch (error) {
    console.error('Failed to fetch timeline events:', error)
    return []
  }
}

/**
 * Pre-fetch patient summary for context
 */
async function fetchPatientSummary(patientId: string): Promise<any> {
  try {
    // Extract practice ID from the page context - we'll need to get it from the patient data
    // For now, we'll use a direct API call that the server will scope
    const response = await fetch(`/api/patients/${patientId}`)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    return data.patient || null
  } catch (error) {
    console.error('Failed to fetch patient summary:', error)
    return null
  }
}

/**
 * Pre-fetch appointment summary for context
 */
async function fetchAppointmentSummary(appointmentId: string): Promise<any> {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}`)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    return data.appointment || null
  } catch (error) {
    console.error('Failed to fetch appointment summary:', error)
    return null
  }
}

