import type { OdBoolean, OdDate, OdDateTime } from './common'

export type Patient = {
  PatNum: number
  LName: string
  FName: string
  MiddleI?: string
  Preferred?: string
  PatStatus?: string
  Gender?: string
  Birthdate?: OdDate
  Address?: string
  Address2?: string
  City?: string
  State?: string
  Zip?: string
  HmPhone?: string
  WkPhone?: string
  WirelessPhone?: string
  Email?: string
  Language?: string
  DateTStamp?: OdDateTime
  ClinicNum?: number
  clinicAbbr?: string
  PriProv?: number
  priProvAbbr?: string
  Guarantor?: number
  [key: string]: unknown
}

export type PatientSimple = Pick<Patient, 'PatNum' | 'LName' | 'FName' | 'Birthdate' | 'PatStatus'>

export type CreatePatientRequest = Partial<Patient> & {
  LName: string
  FName: string
}

export type UpdatePatientRequest = Partial<Patient>

export type PatientListParams = {
  LName?: string
  FName?: string
  Birthdate?: OdDate
  PatStatus?: string
  ClinicNum?: number
  Limit?: number
  Offset?: number
  DateTStamp?: OdDateTime
}

export type Appointment = {
  AptNum: number
  PatNum: number
  AptStatus?: string
  Pattern?: string
  Confirmed?: number
  confirmed?: string
  Op?: number
  ProvNum?: number
  AptDateTime?: OdDateTime
  ProcDescript?: string
  Note?: string
  ClinicNum?: number
  IsNewPatient?: OdBoolean
  [key: string]: unknown
}

export type Provider = {
  ProvNum: number
  Abbr?: string
  FName?: string
  LName?: string
  Specialty?: number
  IsHidden?: OdBoolean
  IsSecondary?: OdBoolean
  [key: string]: unknown
}

export type Clinic = {
  ClinicNum: number
  Description?: string
  Abbr?: string
  Address?: string
  City?: string
  State?: string
  Zip?: string
  Phone?: string
  IsHidden?: OdBoolean
  [key: string]: unknown
}

export type Operatory = {
  OperatoryNum: number
  OpName?: string
  Abbrev?: string
  ClinicNum?: number
  ProvDentist?: number
  ProvHygienist?: number
  IsHidden?: OdBoolean
  [key: string]: unknown
}

export type Schedule = {
  ScheduleNum: number
  SchedDate?: OdDate
  StartTime?: string
  StopTime?: string
  ProvNum?: number
  Op?: number
  SchedType?: string
  [key: string]: unknown
}

export type Definition = {
  DefNum: number
  Category?: number
  ItemName?: string
  ItemValue?: string
  IsHidden?: OdBoolean
  [key: string]: unknown
}

export type Preference = {
  PrefName: string
  ValueString?: string
  [key: string]: unknown
}
