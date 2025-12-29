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
      // Note: Cal.com API v2 does not have a slots/availability endpoint
      // The v1 /slots endpoint exists but requires a v1 API key
      // v2 API keys (which work for event types and bookings) return 401 on v1 endpoints
      
      // Try v1 endpoint (only endpoint that exists for slots)
      const v1BaseUrl = this.baseUrl.replace('/v2', '/v1')
      const params = new URLSearchParams({
        eventTypeId: String(eventTypeId),
        startTime: dateFrom,
        endTime: dateTo,
        timeZone,
      })
      
      const response = await fetch(
        `${v1BaseUrl}/slots?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      // If we get 401, the API key is v2-only and doesn't support v1 endpoints
      // This is expected - Cal.com v2 API doesn't provide slots endpoint
      if (response.status === 401) {
        console.warn('Cal.com v1 slots endpoint requires v1 API key. v2 API keys are not supported for slots endpoint.')
        console.warn('Cal.com API v2 does not provide a slots/availability endpoint.')
        // Return empty array - users will need to enter time manually
        return []
      }
      
      // If v1 returns 404, that's fine - endpoint doesn't exist
      if (response.status === 404) {
        console.warn('Cal.com v1 slots endpoint returned 404. This endpoint may not be available.')
        return []
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com slots API error response:', errorText)
        throw new Error(`Cal.com API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      // Handle different response formats
      if (Array.isArray(data)) {
        return data
      }
      if (data.slots && Array.isArray(data.slots)) {
        return data.slots
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data
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
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cal.com booking API error response:', errorText)
        let errorMessage = `Cal.com booking error: ${response.status} ${response.statusText}`
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch {
          // Use the text error as-is
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

