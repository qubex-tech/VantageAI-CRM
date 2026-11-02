export const NEXHEALTH_API_VERSION = 'v3.0.0'
export const NEXHEALTH_BASE_URL = 'https://nexhealth.info'

export type NexhealthEnvironment = 'sandbox' | 'production'

export type NexhealthLocation = {
  id: number
  name?: string | null
}

export type NexhealthInstitution = {
  id: number
  name?: string | null
  subdomain: string
  locations: NexhealthLocation[]
}

export type NexhealthPatientBio = {
  phone_number?: string | null
  cell_phone_number?: string | null
  home_phone_number?: string | null
  work_phone_number?: string | null
  date_of_birth?: string | null
  gender?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
}

export type NexhealthPatient = {
  id: number
  email?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  name?: string | null
  inactive?: boolean | null
  foreign_id?: string | null
  location_id?: number | null
  bio?: NexhealthPatientBio | null
  phone_number?: string | null
}

export type NexhealthProvider = {
  id: number
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  display_name?: string | null
  inactive?: boolean | null
}

export type NexhealthOperatory = {
  id: number
  name?: string | null
  display_name?: string | null
  inactive?: boolean | null
}

export type NexhealthAppointment = {
  id: number
  patient_id: number
  provider_id?: number | null
  operatory_id?: number | null
  start_time: string
  end_time?: string | null
  cancelled?: boolean | null
  confirmed?: boolean | null
  patient_missed?: boolean | null
  checked_out?: boolean | null
  is_past?: boolean | null
  unavailable?: boolean | null
  note?: string | null
  timezone?: string | null
  location_id?: number | null
  provider_name?: string | null
  appointment_type?: { name?: string | null } | null
}

export type NexhealthSlot = {
  time: string
  end_time?: string | null
  operatory_id?: number | null
  provider_id?: number | null
}

export type NexhealthSlotGroup = {
  lid?: number
  pid?: number
  operatory_id?: number | null
  slots?: NexhealthSlot[]
}

export type NexhealthPageInfo = {
  has_previous_page?: boolean
  has_next_page?: boolean
  start_cursor?: string | null
  end_cursor?: string | null
}

export type NexhealthEnvelope<T> = {
  code?: boolean
  description?: unknown
  error?: unknown
  data?: T
  count?: number | null
  page_info?: NexhealthPageInfo | null
}

export type NexhealthWebhookPayload = {
  institution_id?: number
  subdomain?: string
  webhook_subscription_id?: number
  resource_type?: string
  event_name?: string
  event_time?: string
  data?: Record<string, unknown>
}
