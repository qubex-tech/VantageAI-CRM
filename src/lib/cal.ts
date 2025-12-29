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
   * Create a booking
   */
  async createBooking(params: CreateBookingParams): Promise<CalBooking> {
    try {
      const payload: any = {
        eventTypeId: typeof params.eventTypeId === 'string' ? parseInt(params.eventTypeId, 10) : params.eventTypeId,
        start: params.start,
        end: params.end,
        responses: params.responses,
        timeZone: params.timeZone,
      }

      // Remove undefined fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key]
        }
      })

      const response = await fetch(`${this.baseUrl}/bookings`, {
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
        console.error('Cal.com booking API error response:', errorText)
        console.error('Cal.com booking API request payload:', JSON.stringify(payload, null, 2))
        let errorMessage = `Cal.com booking error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          // Extract error message, handling both string and object formats
          if (errorJson.message) {
            errorMessage = typeof errorJson.message === 'string' 
              ? errorJson.message 
              : JSON.stringify(errorJson.message)
          } else if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'string'
              ? errorJson.error
              : JSON.stringify(errorJson.error)
          } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
            // Handle validation errors array
            errorMessage = errorJson.errors.map((e: any) => 
              typeof e === 'string' ? e : e.message || JSON.stringify(e)
            ).join(', ')
          } else {
            // If we have the full error object, stringify it properly
            errorMessage = JSON.stringify(errorJson)
          }
        } catch (parseError) {
          // If JSON parsing fails, use the text as-is
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      // Handle different response formats
      if (data.booking) {
        return data.booking
      }
      if (data.data) {
        return data.data
      }
      return data
    } catch (error) {
      console.error('Error creating Cal.com booking:', error)
      throw error
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Cal.com cancel error: ${response.statusText}`)
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

