/**
 * Cal.com API Client
 * 
 * Handles interactions with Cal.com API for booking appointments
 * TODO: In production, encrypt API keys and use proper error handling
 */

export interface CalBooking {
  id: string
  uid: string
  startTime: string
  endTime: string
  title: string
  status: string
  eventType: {
    id: string
    title: string
  }
  attendees: Array<{
    email: string
    name: string
  }>
}

export interface CalEventType {
  id: string
  title: string
  slug: string
  length: number
}

export interface CreateBookingParams {
  eventTypeId: string | number
  start: string // ISO datetime
  end: string // ISO datetime
  responses: {
    name: string
    email: string
    phone?: string
    notes?: string
  }
  timeZone: string
}

export interface ReserveSlotParams {
  eventTypeId: string | number
  slotStart: string // ISO datetime in UTC
  slotDuration?: number // Duration in minutes
  reservationDuration?: number // How long to reserve (defaults to 5 minutes)
}

/**
 * Cal.com API Client class
 */
export class CalApiClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl: string = 'https://api.cal.com/v2') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Get available time slots for an event type
   */
  async getAvailableSlots(
    eventTypeId: string,
    dateFrom: string,
    dateTo: string,
    timeZone: string = 'America/New_York'
  ): Promise<Array<{ time: string; attendeeCount: number }>> {
    try {
      // Cal.com API v2 slots endpoint: GET /v2/slots
      // Documentation: https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type
      const params = new URLSearchParams({
        eventTypeId: String(eventTypeId),
        start: dateFrom.split('T')[0], // Extract date part (YYYY-MM-DD)
        end: dateTo.split('T')[0], // Extract date part (YYYY-MM-DD)
        timeZone,
        format: 'range', // Use range format to get start and end times
      })
      
      const response = await fetch(
        `${this.baseUrl}/slots?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'cal-api-version': '2024-09-04', // Required header for v2 API
          },
        }
      )

      if (response.status === 401) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Cal.com API v2 401 Unauthorized:', errorText)
        throw new Error('Cal.com API error: 401 Unauthorized - Please check your API key')
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com slots API error response:', errorText)
        throw new Error(`Cal.com API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Cal.com v2 API returns: { status: "success", data: { "date": [{ start, end, ... }] } }
      if (data.status === 'success' && data.data) {
        // Flatten all slots from all dates into a single array
        const allSlots: Array<{ time: string; attendeeCount: number }> = []
        for (const date in data.data) {
          const slots = data.data[date]
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              // With format=range, each slot has { start, end, attendeesCount?, bookingUid? }
              allSlots.push({
                time: slot.start || slot.time || date,
                attendeeCount: slot.attendeesCount || 0,
              })
            }
          }
        }
        return allSlots
      }
      
      // Fallback for other response formats
      if (data.data && typeof data.data === 'object') {
        const allSlots: Array<{ time: string; attendeeCount: number }> = []
        for (const date in data.data) {
          const slots = data.data[date]
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              allSlots.push({
                time: slot.start || slot.time || date,
                attendeeCount: slot.attendeesCount || 0,
              })
            }
          }
        }
        return allSlots
      }
      
      return []
    } catch (error) {
      console.error('Error fetching Cal.com slots:', error)
      throw error
    }
  }

  /**
   * Reserve a slot (Cal.com v2 API doesn't have direct booking creation endpoint)
   * Documentation: https://cal.com/docs/api-reference/v2/slots/reserve-a-slot
   */
  async reserveSlot(params: ReserveSlotParams): Promise<{
    reservationUid: string
    eventTypeId: number
    slotStart: string
    slotEnd: string
    slotDuration: number
    reservationDuration: number
    reservationUntil: string
  }> {
    try {
      const payload: any = {
        eventTypeId: typeof params.eventTypeId === 'string' ? parseInt(params.eventTypeId, 10) : params.eventTypeId,
        slotStart: params.slotStart,
      }

      // Only include slotDuration if explicitly provided (for variable length event types)
      // For fixed-length event types, omitting it lets it default to the event type's length
      // Note: Including slotDuration for non-variable-length event types causes a 400 error
      if (params.reservationDuration !== undefined) {
        payload.reservationDuration = params.reservationDuration
      }

      const response = await fetch(`${this.baseUrl}/slots/reservations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'cal-api-version': '2024-09-04', // Required header for v2 API
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com slot reservation API error response:', errorText)
        console.error('Cal.com slot reservation API request payload:', JSON.stringify(payload, null, 2))
        let errorMessage = `Cal.com slot reservation error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
            errorMessage = errorJson.errors.map((e: any) => 
              typeof e === 'string' ? e : e.message || JSON.stringify(e)
            ).join(', ')
          } else {
            errorMessage = JSON.stringify(errorJson)
          }
        } catch (parseError) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      if (data.status === 'success' && data.data) {
        return data.data
      }
      throw new Error('Invalid response format from Cal.com slot reservation API')
    } catch (error) {
      console.error('Error reserving Cal.com slot:', error)
      throw error
    }
  }

  /**
   * Create a booking using the Cal.com v2 bookings endpoint
   * Documentation: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
   */
  async createBooking(params: CreateBookingParams): Promise<CalBooking> {
    try {
      const start = new Date(params.start)
      const end = new Date(params.end)
      const lengthInMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))

      const payload: any = {
        start: start.toISOString(),
        eventTypeId: typeof params.eventTypeId === 'string' ? parseInt(params.eventTypeId, 10) : params.eventTypeId,
        attendee: {
          name: params.responses.name,
          email: params.responses.email,
          timeZone: params.timeZone || 'America/New_York',
          ...(params.responses.phone && { phoneNumber: params.responses.phone }),
          language: 'en',
        },
      }

      // Include lengthInMinutes if it differs from the default (optional for fixed-length event types)
      if (lengthInMinutes > 0) {
        payload.lengthInMinutes = lengthInMinutes
      }

      // Include notes in bookingFieldsResponses if provided
      if (params.responses.notes) {
        payload.bookingFieldsResponses = {
          notes: params.responses.notes,
        }
      }

      const response = await fetch(`${this.baseUrl}/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'cal-api-version': '2024-08-13', // Required header - must be 2024-08-13 per documentation
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com booking API error response:', errorText)
        console.error('Cal.com booking API request payload:', JSON.stringify(payload, null, 2))
        let errorMessage = `Cal.com booking error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
            errorMessage = errorJson.errors.map((e: any) => 
              typeof e === 'string' ? e : e.message || JSON.stringify(e)
            ).join(', ')
          } else {
            errorMessage = JSON.stringify(errorJson)
          }
        } catch (parseError) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Cal.com v2 API returns: { status: "success", data: { ...booking data... } }
      if (data.status === 'success' && data.data) {
        const booking = data.data
        return {
          id: String(booking.id ?? booking.uid),
          uid: booking.uid ?? String(booking.id),
          startTime: booking.start,
          endTime: booking.end,
          title: booking.title || 'Appointment',
          status: booking.status || 'scheduled',
          eventType: {
            id: String(booking.eventTypeId ?? booking.eventType?.id ?? ''),
            title: booking.eventType?.slug || 'Appointment',
          },
          attendees: booking.attendees?.map((a: any) => ({
            email: a.email,
            name: a.name,
          })) || [
            {
              email: params.responses.email,
              name: params.responses.name,
            },
          ],
        }
      }
      
      throw new Error('Invalid response format from Cal.com booking API')
    } catch (error) {
      console.error('Error creating Cal.com booking:', error)
      throw error
    }
  }

  /**
   * Cancel a booking
   * Documentation: https://cal.com/docs/api-reference/v2/bookings/cancel-a-booking
   */
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'cal-api-version': '2024-09-04',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Cal.com cancel error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          }
        } catch (parseError) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error canceling Cal.com booking:', error)
      throw error
    }
  }

  /**
   * Get event types
   */
  async getEventTypes(): Promise<CalEventType[]> {
    try {
      const response = await fetch(`${this.baseUrl}/event-types`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com API error response:', errorText)
        throw new Error(`Cal.com API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Cal.com API v2 structure: { status: "success", data: { eventTypeGroups: [{ eventTypes: [...] }] } }
      if (data.data?.eventTypeGroups && Array.isArray(data.data.eventTypeGroups)) {
        // Flatten event types from all groups
        const eventTypes: CalEventType[] = []
        for (const group of data.data.eventTypeGroups) {
          if (group.eventTypes && Array.isArray(group.eventTypes)) {
            for (const et of group.eventTypes) {
              eventTypes.push({
                id: et.id,
                title: et.title || et.eventName || 'Untitled',
                slug: et.slug || String(et.id),
                length: et.length || 30,
              })
            }
          }
        }
        return eventTypes
      }
      
      // Fallback for other formats
      if (Array.isArray(data)) {
        return data.map((et: any) => ({
          id: et.id,
          title: et.title || et.eventName || 'Untitled',
          slug: et.slug || String(et.id),
          length: et.length || 30,
        }))
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((et: any) => ({
          id: et.id,
          title: et.title || et.eventName || 'Untitled',
          slug: et.slug || String(et.id),
          length: et.length || 30,
        }))
      }
      if (data.event_types && Array.isArray(data.event_types)) {
        return data.event_types.map((et: any) => ({
          id: et.id,
          title: et.title || et.eventName || 'Untitled',
          slug: et.slug || String(et.id),
          length: et.length || 30,
          description: et.description,
        }))
      }
      return []
    } catch (error) {
      console.error('Error fetching Cal.com event types:', error)
      throw error
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getEventTypes()
      return true
    } catch (error) {
      return false
    }
  }
}

/**
 * Get Cal.com client for a practice
 */
export async function getCalClient(practiceId: string) {
  const { prisma } = await import('./db')
  
  const integration = await prisma.calIntegration.findUnique({
    where: { practiceId },
  })

  if (!integration || !integration.isActive) {
    throw new Error('Cal.com integration not configured for this practice')
  }

  return new CalApiClient(integration.apiKey)
}

