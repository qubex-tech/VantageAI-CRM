/**
 * Source-of-truth capability definitions derived from Open Dental API Permissions
 * https://www.opendental.com/site/apipermissions.html
 *
 * Run: npx tsx scripts/generate-opendental-capability-matrix.ts
 */

import fs from 'fs'
import path from 'path'

type PermissionTier =
  | 'ReadAll'
  | 'AllOthers'
  | 'Comm'
  | 'Documents'
  | 'Queries'
  | 'Appointments'
  | 'InsuranceSimple'
  | 'Insurance'
  | 'Patients'
  | 'Payments'
  | 'PayPlans'
  | 'ProcedureLogs'
  | 'Setup'
  | 'TextingASAP'
  | 'Enterprise'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type CapabilityOperation = {
  resource: string
  operation: string
  httpMethod: HttpMethod
  path: string
  permissionTier: PermissionTier
  supportsPagination: boolean
  supportsIncrementalSync: boolean
  lastModifiedField?: string
  notes?: string
}

function op(
  resource: string,
  operation: string,
  httpMethod: HttpMethod,
  pathSuffix: string,
  permissionTier: PermissionTier,
  opts: Partial<CapabilityOperation> = {}
): CapabilityOperation {
  const path = pathSuffix.startsWith('/') ? pathSuffix : `/${resource.toLowerCase()}${pathSuffix ? `/${pathSuffix}` : ''}`
  return {
    resource,
    operation,
    httpMethod,
    path,
    permissionTier,
    supportsPagination: httpMethod === 'GET' && !pathSuffix.includes('/'),
    supportsIncrementalSync: false,
    ...opts,
  }
}

/** All verified operations from official API permissions documentation */
export const CAPABILITY_OPERATIONS: CapabilityOperation[] = [
  // AccountModules
  op('AccountModules', 'GetAging', 'GET', '/accountmodules/aging', 'ReadAll'),
  op('AccountModules', 'GetPatientBalances', 'GET', '/accountmodules/patientbalances', 'ReadAll'),
  op('AccountModules', 'GetServiceDateView', 'GET', '/accountmodules/servicedateview', 'ReadAll'),

  // Adjustments
  op('Adjustments', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Adjustments', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Adjustments', 'Create', 'POST', '', 'AllOthers'),
  op('Adjustments', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Allergies
  op('Allergies', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Allergies', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Allergies', 'Create', 'POST', '', 'AllOthers'),
  op('Allergies', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Allergies', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // AllergyDefs
  op('AllergyDefs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('AllergyDefs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('AllergyDefs', 'Create', 'POST', '', 'Setup'),
  op('AllergyDefs', 'Update', 'PUT', '/{id}', 'Setup'),

  // Appointments
  op('Appointments', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Appointments', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Appointments', 'GetSlotsWebSched', 'GET', '/slotswebsched', 'ReadAll'),
  op('Appointments', 'GetSlots', 'GET', '/slots', 'ReadAll'),
  op('Appointments', 'GetASAP', 'GET', '/asap', 'ReadAll'),
  op('Appointments', 'GetWebSched', 'GET', '/websched', 'ReadAll'),
  op('Appointments', 'Create', 'POST', '', 'Appointments'),
  op('Appointments', 'CreatePlanned', 'POST', '/planned', 'Appointments'),
  op('Appointments', 'CreateSchedulePlanned', 'POST', '/scheduleplanned', 'Appointments'),
  op('Appointments', 'CreateWebSched', 'POST', '/websched', 'Appointments'),
  op('Appointments', 'Update', 'PUT', '/{id}', 'Appointments'),
  op('Appointments', 'Break', 'PUT', '/{id}/break', 'Comm'),
  op('Appointments', 'Confirm', 'PUT', '/{id}/confirm', 'Comm'),
  op('Appointments', 'UpdateNote', 'PUT', '/{id}/note', 'Comm'),

  // AppointmentTypes
  op('AppointmentTypes', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('AppointmentTypes', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // ApptFieldDefs
  op('ApptFieldDefs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ApptFieldDefs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('ApptFieldDefs', 'Create', 'POST', '', 'Setup'),
  op('ApptFieldDefs', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // ApptFields
  op('ApptFields', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ApptFields', 'Create', 'POST', '', 'AllOthers'),
  op('ApptFields', 'Update', 'PUT', '/{id}', 'Comm'),
  op('ApptFields', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // AsapComms
  op('AsapComms', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('AsapComms', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('AsapComms', 'Create', 'POST', '', 'TextingASAP'),

  // AutoNoteControls
  op('AutoNoteControls', 'Get', 'GET', '', 'ReadAll'),
  op('AutoNoteControls', 'Create', 'POST', '', 'AllOthers'),
  op('AutoNoteControls', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // AutoNotes
  op('AutoNotes', 'Get', 'GET', '', 'ReadAll'),
  op('AutoNotes', 'Create', 'POST', '', 'AllOthers'),
  op('AutoNotes', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Benefits
  op('Benefits', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Benefits', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Benefits', 'Create', 'POST', '', 'Insurance'),
  op('Benefits', 'Update', 'PUT', '/{id}', 'Insurance'),
  op('Benefits', 'Delete', 'DELETE', '/{id}', 'Insurance'),

  // Carriers
  op('Carriers', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Carriers', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Carriers', 'Create', 'POST', '', 'AllOthers'),
  op('Carriers', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // ChartModules
  op('ChartModules', 'GetProgNotes', 'GET', '/chartmodules/prognotes', 'ReadAll'),
  op('ChartModules', 'GetPatientInfo', 'GET', '/chartmodules/patientinfo', 'ReadAll'),
  op('ChartModules', 'GetPlannedAppts', 'GET', '/chartmodules/plannedappts', 'ReadAll'),

  // ClaimForms
  op('ClaimForms', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ClaimForms', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // ClaimProcs
  op('ClaimProcs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ClaimProcs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('ClaimProcs', 'CreateInsAdjust', 'POST', '/insadjust', 'InsuranceSimple'),
  op('ClaimProcs', 'UpdateInsAdjust', 'PUT', '/insadjust', 'InsuranceSimple'),
  op('ClaimProcs', 'CreateSupplemental', 'POST', '/supplemental', 'Insurance'),
  op('ClaimProcs', 'Update', 'PUT', '/{id}', 'Insurance'),

  // ClaimPayments
  op('ClaimPayments', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ClaimPayments', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('ClaimPayments', 'Create', 'POST', '', 'Insurance'),
  op('ClaimPayments', 'CreateBatch', 'POST', '/batch', 'Insurance'),
  op('ClaimPayments', 'Update', 'PUT', '/{id}', 'Insurance'),
  op('ClaimPayments', 'Delete', 'DELETE', '/{id}', 'Insurance'),

  // Claims
  op('Claims', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Claims', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Claims', 'Create', 'POST', '', 'Insurance'),
  op('Claims', 'Update', 'PUT', '/{id}', 'Insurance'),
  op('Claims', 'Delete', 'DELETE', '/{id}', 'Insurance'),
  op('Claims', 'UpdateStatus', 'PUT', '/{id}/status', 'Insurance'),
  op('Claims', 'Split', 'PUT', '/{id}/split', 'Insurance'),

  // ClaimTrackings
  op('ClaimTrackings', 'Get', 'GET', '', 'ReadAll'),
  op('ClaimTrackings', 'Create', 'POST', '', 'Insurance'),
  op('ClaimTrackings', 'Update', 'PUT', '/{id}', 'Insurance'),

  // Clinics
  op('Clinics', 'Get', 'GET', '', 'ReadAll'),
  op('Clinics', 'Update', 'PUT', '/{id}', 'Setup'),

  // ClockEvents
  op('ClockEvents', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ClockEvents', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // CodeGroups
  op('CodeGroups', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('CodeGroups', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // Commlogs
  op('Commlogs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Commlogs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Commlogs', 'Create', 'POST', '', 'Comm'),

  // Computers
  op('Computers', 'Get', 'GET', '', 'ReadAll'),

  // CovCats
  op('CovCats', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('CovCats', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('CovCats', 'Create', 'POST', '', 'Setup'),
  op('CovCats', 'Update', 'PUT', '/{id}', 'Setup'),

  // CovSpans
  op('CovSpans', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('CovSpans', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('CovSpans', 'Create', 'POST', '', 'Setup'),
  op('CovSpans', 'Update', 'PUT', '/{id}', 'Setup'),
  op('CovSpans', 'Delete', 'DELETE', '/{id}', 'Setup'),

  // Definitions
  op('Definitions', 'Get', 'GET', '', 'ReadAll'),
  op('Definitions', 'Create', 'POST', '', 'Setup'),

  // Deposits
  op('Deposits', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Deposits', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Deposits', 'Create', 'POST', '', 'AllOthers'),
  op('Deposits', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Deposits', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // DiscountPlans
  op('DiscountPlans', 'Get', 'GET', '', 'ReadAll'),
  op('DiscountPlans', 'Create', 'POST', '', 'AllOthers'),
  op('DiscountPlans', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // DiscountPlanSubs
  op('DiscountPlanSubs', 'Get', 'GET', '', 'ReadAll'),
  op('DiscountPlanSubs', 'Create', 'POST', '', 'AllOthers'),
  op('DiscountPlanSubs', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('DiscountPlanSubs', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Diseases
  op('Diseases', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Diseases', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Diseases', 'Create', 'POST', '', 'AllOthers'),
  op('Diseases', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Diseases', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // DiseaseDefs
  op('DiseaseDefs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('DiseaseDefs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('DiseaseDefs', 'Create', 'POST', '', 'Setup'),

  // Documents
  op('Documents', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Documents', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Documents', 'Upload', 'POST', '/upload', 'Documents'),
  op('Documents', 'DownloadSftp', 'POST', '/downloadsftp', 'AllOthers'),
  op('Documents', 'SetByUrl', 'POST', '/setbyurl', 'AllOthers'),
  op('Documents', 'UploadSftp', 'POST', '/uploadsftp', 'AllOthers'),
  op('Documents', 'Thumbnails', 'POST', '/thumbnails', 'AllOthers'),
  op('Documents', 'DownloadMount', 'POST', '/downloadmount', 'AllOthers'),
  op('Documents', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Documents', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // EhrPatients
  op('EhrPatients', 'Get', 'GET', '', 'ReadAll'),
  op('EhrPatients', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // EobAttaches
  op('EobAttaches', 'Get', 'GET', '', 'ReadAll'),
  op('EobAttaches', 'Create', 'POST', '', 'AllOthers'),
  op('EobAttaches', 'Delete', 'DELETE', '/{id}', 'AllOthers'),
  op('EobAttaches', 'DownloadSftp', 'POST', '/downloadsftp', 'AllOthers'),
  op('EobAttaches', 'UploadSftp', 'POST', '/uploadsftp', 'AllOthers'),

  // Employees
  op('Employees', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Employees', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Employees', 'Create', 'POST', '', 'Setup'),
  op('Employees', 'Update', 'PUT', '/{id}', 'Setup'),

  // Employers
  op('Employers', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Employers', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Employers', 'Create', 'POST', '', 'AllOthers'),
  op('Employers', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Employers', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // EtransMessageTexts
  op('EtransMessageTexts', 'Get', 'GET', '', 'ReadAll'),

  // Etranss
  op('Etranss', 'Get', 'GET', '', 'ReadAll'),

  // FamilyModules
  op('FamilyModules', 'GetInsurance', 'GET', '/familymodules/insurance', 'ReadAll'),

  // Fees
  op('Fees', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Fees', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Fees', 'Create', 'POST', '', 'AllOthers'),
  op('Fees', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Fees', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // FeeScheds
  op('FeeScheds', 'Get', 'GET', '', 'ReadAll'),
  op('FeeScheds', 'Create', 'POST', '', 'AllOthers'),
  op('FeeScheds', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Guardians
  op('Guardians', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Guardians', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Guardians', 'Create', 'POST', '', 'AllOthers'),
  op('Guardians', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // HistAppointments
  op('HistAppointments', 'Get', 'GET', '', 'ReadAll'),

  // InsPlans
  op('InsPlans', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('InsPlans', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('InsPlans', 'Create', 'POST', '', 'Insurance'),
  op('InsPlans', 'Update', 'PUT', '/{id}', 'Insurance'),

  // InsSubs
  op('InsSubs', 'Create', 'POST', '', 'InsuranceSimple'),
  op('InsSubs', 'Update', 'PUT', '/{id}', 'InsuranceSimple'),
  op('InsSubs', 'Delete', 'DELETE', '/{id}', 'InsuranceSimple'),

  // InsVerifies
  op('InsVerifies', 'Update', 'PUT', '/{id}', 'InsuranceSimple'),

  // LabCases
  op('LabCases', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('LabCases', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('LabCases', 'Create', 'POST', '', 'AllOthers'),
  op('LabCases', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('LabCases', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Laboratories
  op('Laboratories', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Laboratories', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Laboratories', 'Create', 'POST', '', 'AllOthers'),
  op('Laboratories', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // LabTurnarounds
  op('LabTurnarounds', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('LabTurnarounds', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('LabTurnarounds', 'Create', 'POST', '', 'AllOthers'),
  op('LabTurnarounds', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Medications
  op('Medications', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Medications', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Medications', 'Create', 'POST', '', 'Setup'),
  op('Medications', 'Update', 'PUT', '/{id}', 'Setup'),
  op('Medications', 'Delete', 'DELETE', '/{id}', 'Setup'),

  // MedicationPats
  op('MedicationPats', 'Get', 'GET', '', 'ReadAll'),
  op('MedicationPats', 'Create', 'POST', '', 'AllOthers'),
  op('MedicationPats', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Operatories
  op('Operatories', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Operatories', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // PatFieldDefs
  op('PatFieldDefs', 'Get', 'GET', '', 'ReadAll'),
  op('PatFieldDefs', 'Create', 'POST', '', 'AllOthers'),
  op('PatFieldDefs', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('PatFieldDefs', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // PatFields
  op('PatFields', 'Get', 'GET', '', 'ReadAll'),
  op('PatFields', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // PatientNotes
  op('PatientNotes', 'Get', 'GET', '', 'ReadAll'),
  op('PatientNotes', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // PatientRaces
  op('PatientRaces', 'Get', 'GET', '', 'ReadAll'),

  // Patients
  op('Patients', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true, supportsIncrementalSync: true, lastModifiedField: 'DateTStamp' }),
  op('Patients', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Patients', 'GetSimple', 'GET', '/simple', 'ReadAll', { supportsPagination: true }),
  op('Patients', 'Create', 'POST', '', 'Patients'),
  op('Patients', 'Update', 'PUT', '/{id}', 'Patients'),

  // PatPlans
  op('PatPlans', 'Get', 'GET', '', 'ReadAll'),
  op('PatPlans', 'Create', 'POST', '', 'InsuranceSimple'),
  op('PatPlans', 'Delete', 'DELETE', '/{id}', 'InsuranceSimple'),

  // PatRestrictions
  op('PatRestrictions', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('PatRestrictions', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('PatRestrictions', 'Create', 'POST', '', 'Patients'),
  op('PatRestrictions', 'Delete', 'DELETE', '/{id}', 'Patients'),

  // Payments
  op('Payments', 'Get', 'GET', '', 'ReadAll'),
  op('Payments', 'Create', 'POST', '', 'Payments'),
  op('Payments', 'CreateRefund', 'POST', '/refund', 'Payments'),
  op('Payments', 'Update', 'PUT', '/{id}', 'Payments'),
  op('Payments', 'UpdatePartial', 'PUT', '/{id}/partial', 'Payments'),

  // PayPlanCharges
  op('PayPlanCharges', 'Get', 'GET', '', 'ReadAll'),

  // PayPlanLinks
  op('PayPlanLinks', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('PayPlanLinks', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('PayPlanLinks', 'Create', 'POST', '', 'PayPlans'),
  op('PayPlanLinks', 'Update', 'PUT', '/{id}', 'PayPlans'),
  op('PayPlanLinks', 'Delete', 'DELETE', '/{id}', 'PayPlans'),

  // PayPlans
  op('PayPlans', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('PayPlans', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('PayPlans', 'Create', 'POST', '', 'PayPlans', { notes: 'Deprecated in version 23.3' }),
  op('PayPlans', 'CreateDynamic', 'POST', '/dynamic', 'PayPlans'),
  op('PayPlans', 'UpdateDynamic', 'PUT', '/{id}/dynamic', 'PayPlans'),

  // PaySplits
  op('PaySplits', 'Get', 'GET', '', 'ReadAll'),
  op('PaySplits', 'Update', 'PUT', '/{id}', 'Payments'),

  // PerioExams
  op('PerioExams', 'Get', 'GET', '', 'ReadAll'),
  op('PerioExams', 'Create', 'POST', '', 'AllOthers'),
  op('PerioExams', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('PerioExams', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // PerioMeasures
  op('PerioMeasures', 'Get', 'GET', '', 'ReadAll'),
  op('PerioMeasures', 'Create', 'POST', '', 'AllOthers'),
  op('PerioMeasures', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('PerioMeasures', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Pharmacies
  op('Pharmacies', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Pharmacies', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // Popups
  op('Popups', 'Get', 'GET', '', 'ReadAll'),
  op('Popups', 'Create', 'POST', '', 'Comm'),
  op('Popups', 'Update', 'PUT', '/{id}', 'Comm'),

  // Preferences
  op('Preferences', 'Get', 'GET', '', 'ReadAll'),

  // ProcedureCodes
  op('ProcedureCodes', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ProcedureCodes', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('ProcedureCodes', 'Create', 'POST', '', 'AllOthers'),
  op('ProcedureCodes', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // ProcedureLogs
  op('ProcedureLogs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('ProcedureLogs', 'GetInsuranceHistory', 'GET', '/insurancehistory', 'ReadAll'),
  op('ProcedureLogs', 'Create', 'POST', '', 'ProcedureLogs'),
  op('ProcedureLogs', 'CreateInsuranceHistory', 'POST', '/insurancehistory', 'ProcedureLogs'),
  op('ProcedureLogs', 'Update', 'PUT', '/{id}', 'ProcedureLogs'),
  op('ProcedureLogs', 'Delete', 'DELETE', '/{id}', 'ProcedureLogs'),
  op('ProcedureLogs', 'CreateGroupNote', 'POST', '/groupnote', 'AllOthers'),
  op('ProcedureLogs', 'UpdateGroupNote', 'PUT', '/groupnote', 'AllOthers'),
  op('ProcedureLogs', 'DeleteGroupNote', 'DELETE', '/groupnote', 'AllOthers'),

  // ProcNotes
  op('ProcNotes', 'Get', 'GET', '', 'ReadAll'),
  op('ProcNotes', 'Create', 'POST', '', 'AllOthers'),

  // ProcTPs
  op('ProcTPs', 'Get', 'GET', '', 'ReadAll'),
  op('ProcTPs', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('ProcTPs', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Providers
  op('Providers', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Providers', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Providers', 'Create', 'POST', '', 'Setup'),
  op('Providers', 'Update', 'PUT', '/{id}', 'Setup'),

  // QuickPasteCats
  op('QuickPasteCats', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('QuickPasteCats', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // QuickPasteNotes
  op('QuickPasteNotes', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('QuickPasteNotes', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // Recalls
  op('Recalls', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Recalls', 'GetList', 'GET', '/list', 'ReadAll'),
  op('Recalls', 'Create', 'POST', '', 'AllOthers'),
  op('Recalls', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('Recalls', 'UpdateStatus', 'PUT', '/{id}/status', 'Comm'),
  op('Recalls', 'SwitchType', 'PUT', '/{id}/switchtype', 'AllOthers'),

  // RecallTypes
  op('RecallTypes', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('RecallTypes', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // RefAttaches
  op('RefAttaches', 'Get', 'GET', '', 'ReadAll'),
  op('RefAttaches', 'Create', 'POST', '', 'AllOthers'),
  op('RefAttaches', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('RefAttaches', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Referrals
  op('Referrals', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Referrals', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Referrals', 'Create', 'POST', '', 'AllOthers'),
  op('Referrals', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Reports
  op('Reports', 'GetAging', 'GET', '/reports/aging', 'ReadAll'),
  op('Reports', 'GetFinanceCharges', 'GET', '/reports/financecharges', 'ReadAll'),

  // RxPats
  op('RxPats', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('RxPats', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // SecurityLogs
  op('SecurityLogs', 'Get', 'GET', '', 'ReadAll'),

  // SecurityPerms
  op('SecurityPerms', 'Get', 'GET', '', 'ReadAll'),

  // ScheduleOps
  op('ScheduleOps', 'Get', 'GET', '', 'ReadAll'),

  // Schedules
  op('Schedules', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Schedules', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // SheetDefs
  op('SheetDefs', 'Get', 'GET', '', 'ReadAll'),

  // Sheets
  op('Sheets', 'Get', 'GET', '', 'ReadAll'),
  op('Sheets', 'Create', 'POST', '', 'AllOthers'),
  op('Sheets', 'DownloadSftp', 'POST', '/downloadsftp', 'AllOthers'),

  // SheetFieldDefs
  op('SheetFieldDefs', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('SheetFieldDefs', 'GetSingle', 'GET', '/{id}', 'ReadAll'),

  // SheetFields
  op('SheetFields', 'Get', 'GET', '', 'ReadAll'),

  // Signalods
  op('Signalods', 'Get', 'GET', '', 'ReadAll', { supportsIncrementalSync: true, lastModifiedField: 'SigDateTime' }),

  // Statements
  op('Statements', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Statements', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Statements', 'Create', 'POST', '', 'AllOthers'),
  op('Statements', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // Subscriptions
  op('Subscriptions', 'Get', 'GET', '', 'ReadAll'),
  op('Subscriptions', 'Create', 'POST', '', 'ReadAll'),
  op('Subscriptions', 'Update', 'PUT', '/{id}', 'ReadAll'),

  // SubstitutionLinks
  op('SubstitutionLinks', 'Get', 'GET', '', 'ReadAll'),
  op('SubstitutionLinks', 'Create', 'POST', '', 'AllOthers'),
  op('SubstitutionLinks', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('SubstitutionLinks', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // TaskLists
  op('TaskLists', 'Get', 'GET', '', 'ReadAll'),

  // TaskNotes
  op('TaskNotes', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('TaskNotes', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('TaskNotes', 'Create', 'POST', '', 'AllOthers'),
  op('TaskNotes', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // Tasks
  op('Tasks', 'Get', 'GET', '', 'ReadAll', { supportsPagination: true }),
  op('Tasks', 'GetSingle', 'GET', '/{id}', 'ReadAll'),
  op('Tasks', 'Create', 'POST', '', 'AllOthers'),
  op('Tasks', 'Update', 'PUT', '/{id}', 'AllOthers'),

  // ToothInitials
  op('ToothInitials', 'Get', 'GET', '', 'ReadAll'),
  op('ToothInitials', 'Create', 'POST', '', 'AllOthers'),
  op('ToothInitials', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // TreatPlanAttaches
  op('TreatPlanAttaches', 'Get', 'GET', '', 'ReadAll'),

  // TreatPlans
  op('TreatPlans', 'Get', 'GET', '', 'ReadAll'),
  op('TreatPlans', 'Create', 'POST', '', 'AllOthers'),
  op('TreatPlans', 'CreateSaved', 'POST', '/saved', 'AllOthers'),
  op('TreatPlans', 'Update', 'PUT', '/{id}', 'AllOthers'),
  op('TreatPlans', 'Delete', 'DELETE', '/{id}', 'AllOthers'),

  // UserGroupAttaches
  op('UserGroupAttaches', 'Get', 'GET', '', 'ReadAll'),

  // UserGroups
  op('UserGroups', 'Get', 'GET', '', 'ReadAll'),

  // Userods
  op('Userods', 'Get', 'GET', '', 'ReadAll'),
  op('Userods', 'Create', 'POST', '', 'Setup'),
  op('Userods', 'Update', 'PUT', '/{id}', 'Setup'),

  // Queries
  op('Queries', 'Post', 'POST', '', 'Queries'),
  op('Queries', 'ShortQuery', 'PUT', '/shortquery', 'Queries'),
]

function buildSyncCapabilities(operations: CapabilityOperation[]) {
  const byResource = new Map<string, CapabilityOperation[]>()
  for (const o of operations) {
    const list = byResource.get(o.resource) ?? []
    list.push(o)
    byResource.set(o.resource, list)
  }

  const capabilities: Record<string, unknown> = {}
  for (const [resource, ops] of byResource) {
    capabilities[resource] = {
      uniqueId: `${resource}Num`,
      search: ops.some((o) => o.httpMethod === 'GET' && o.operation.startsWith('Get') && !o.operation.includes('Single')),
      create: ops.some((o) => o.httpMethod === 'POST'),
      update: ops.some((o) => o.httpMethod === 'PUT'),
      delete: ops.some((o) => o.httpMethod === 'DELETE'),
      bulkRead: ops.some((o) => o.supportsPagination),
      incrementalRead: ops.some((o) => o.supportsIncrementalSync),
      lastModifiedField: ops.find((o) => o.lastModifiedField)?.lastModifiedField ?? null,
      operations: ops.map((o) => o.operation),
    }
  }
  return capabilities
}

function generateMarkdown(operations: CapabilityOperation[]): string {
  const lines = [
    '# Open Dental API Capability Matrix',
    '',
    'Generated from official API permissions documentation.',
    'Source: https://www.opendental.com/site/apipermissions.html',
    '',
    `Total operations: ${operations.length}`,
    '',
    '| Resource | Operation | Method | Path | Permission | Pagination | Incremental |',
    '|----------|-----------|--------|------|------------|------------|-------------|',
  ]

  for (const o of operations) {
    lines.push(
      `| ${o.resource} | ${o.operation} | ${o.httpMethod} | \`${o.path}\` | ${o.permissionTier} | ${o.supportsPagination ? 'Yes' : 'No'} | ${o.supportsIncrementalSync ? 'Yes' : 'No'} |`
    )
  }

  return lines.join('\n')
}

const root = path.resolve(__dirname, '..')
const sdkSrc = path.join(root, 'packages/opendental-sdk/src')
const sdkDocs = path.join(root, 'packages/opendental-sdk/docs')

const matrix = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  sourceUrl: 'https://www.opendental.com/site/apipermissions.html',
  totalOperations: CAPABILITY_OPERATIONS.length,
  operations: CAPABILITY_OPERATIONS,
  syncCapabilities: buildSyncCapabilities(CAPABILITY_OPERATIONS),
  resources: [...new Set(CAPABILITY_OPERATIONS.map((o) => o.resource))].sort(),
}

fs.mkdirSync(sdkSrc, { recursive: true })
fs.mkdirSync(sdkDocs, { recursive: true })

fs.writeFileSync(
  path.join(sdkSrc, 'capability-matrix.json'),
  JSON.stringify(matrix, null, 2)
)

fs.writeFileSync(
  path.join(sdkDocs, 'capability-matrix.md'),
  generateMarkdown(CAPABILITY_OPERATIONS)
)

console.log(`Generated capability matrix: ${CAPABILITY_OPERATIONS.length} operations across ${matrix.resources.length} resources`)
