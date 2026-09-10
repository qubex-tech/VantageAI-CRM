import { describe, expect, it } from 'vitest'
import {
  mapFhirPatientActive,
  mapOpenDentalPatientActive,
} from '@/lib/integrations/ehr/patientActive'
import {
  mapFhirPatientRecord,
  mergePatientUpdate,
} from '@/lib/integrations/ehr/ecwPatientRosterSync'

describe('mapFhirPatientActive', () => {
  it('maps true and false from FHIR Patient.active', () => {
    expect(mapFhirPatientActive({ active: true })).toBe(true)
    expect(mapFhirPatientActive({ active: false })).toBe(false)
  })

  it('returns null when active is missing or not a boolean', () => {
    expect(mapFhirPatientActive({})).toBeNull()
    expect(mapFhirPatientActive({ active: undefined })).toBeNull()
    expect(mapFhirPatientActive(null)).toBeNull()
  })
})

describe('mapOpenDentalPatientActive', () => {
  it('maps Open Dental PatStatus to Active/Inactive', () => {
    expect(mapOpenDentalPatientActive('Patient')).toBe(true)
    expect(mapOpenDentalPatientActive('NonPatient')).toBe(true)
    expect(mapOpenDentalPatientActive('Prospective')).toBe(true)
    expect(mapOpenDentalPatientActive('Inactive')).toBe(false)
    expect(mapOpenDentalPatientActive('Archived')).toBe(false)
    expect(mapOpenDentalPatientActive('Deleted')).toBe(false)
    expect(mapOpenDentalPatientActive('Deceased')).toBe(false)
  })

  it('returns null when PatStatus is missing', () => {
    expect(mapOpenDentalPatientActive(undefined)).toBeNull()
    expect(mapOpenDentalPatientActive('')).toBeNull()
  })
})

describe('mapFhirPatientRecord ehrActive', () => {
  it('includes ehrActive on the mapped patient record', () => {
    expect(mapFhirPatientRecord({ resourceType: 'Patient', id: '1', active: false }).ehrActive).toBe(
      false
    )
    expect(mapFhirPatientRecord({ resourceType: 'Patient', id: '2', active: true }).ehrActive).toBe(
      true
    )
    expect(mapFhirPatientRecord({ resourceType: 'Patient', id: '3' }).ehrActive).toBeNull()
  })
})

describe('mergePatientUpdate ehrActive', () => {
  it('persists Inactive (false) over Active (true)', () => {
    expect(
      mergePatientUpdate({ ehrActive: true, name: 'Pat' }, { ehrActive: false, name: 'Pat' })
    ).toEqual({ ehrActive: false })
  })

  it('persists Inactive when the stored value is unknown', () => {
    expect(mergePatientUpdate({ ehrActive: null }, { ehrActive: false })).toEqual({
      ehrActive: false,
    })
  })

  it('does not clear a stored status when the EHR omits active', () => {
    expect(mergePatientUpdate({ ehrActive: true }, { ehrActive: null })).toEqual({})
  })
})
