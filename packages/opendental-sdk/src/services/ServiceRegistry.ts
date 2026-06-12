import type { OpenDentalClient } from '../client/OpenDentalClient'
import type { PracticeContext } from '../practice/types'
import { AccountModulesService } from './generated/AccountModulesService'
import { AdjustmentsService } from './generated/AdjustmentsService'
import { AllergiesService } from './generated/AllergiesService'
import { AllergyDefsService } from './generated/AllergyDefsService'
import { AppointmentsService } from './generated/AppointmentsService'
import { AppointmentTypesService } from './generated/AppointmentTypesService'
import { ApptFieldDefsService } from './generated/ApptFieldDefsService'
import { ApptFieldsService } from './generated/ApptFieldsService'
import { AsapCommsService } from './generated/AsapCommsService'
import { AutoNoteControlsService } from './generated/AutoNoteControlsService'
import { AutoNotesService } from './generated/AutoNotesService'
import { BenefitsService } from './generated/BenefitsService'
import { CarriersService } from './generated/CarriersService'
import { ChartModulesService } from './generated/ChartModulesService'
import { ClaimFormsService } from './generated/ClaimFormsService'
import { ClaimPaymentsService } from './generated/ClaimPaymentsService'
import { ClaimProcsService } from './generated/ClaimProcsService'
import { ClaimsService } from './generated/ClaimsService'
import { ClaimTrackingsService } from './generated/ClaimTrackingsService'
import { ClinicsService } from './generated/ClinicsService'
import { ClockEventsService } from './generated/ClockEventsService'
import { CodeGroupsService } from './generated/CodeGroupsService'
import { CommlogsService } from './generated/CommlogsService'
import { ComputersService } from './generated/ComputersService'
import { CovCatsService } from './generated/CovCatsService'
import { CovSpansService } from './generated/CovSpansService'
import { DefinitionsService } from './generated/DefinitionsService'
import { DepositsService } from './generated/DepositsService'
import { DiscountPlansService } from './generated/DiscountPlansService'
import { DiscountPlanSubsService } from './generated/DiscountPlanSubsService'
import { DiseasesService } from './generated/DiseasesService'
import { DiseaseDefsService } from './generated/DiseaseDefsService'
import { DocumentsService } from './generated/DocumentsService'
import { EhrPatientsService } from './generated/EhrPatientsService'
import { EobAttachesService } from './generated/EobAttachesService'
import { EmployeesService } from './generated/EmployeesService'
import { EmployersService } from './generated/EmployersService'
import { EtransMessageTextsService } from './generated/EtransMessageTextsService'
import { EtranssService } from './generated/EtranssService'
import { FamilyModulesService } from './generated/FamilyModulesService'
import { FeesService } from './generated/FeesService'
import { FeeSchedsService } from './generated/FeeSchedsService'
import { GuardiansService } from './generated/GuardiansService'
import { HistAppointmentsService } from './generated/HistAppointmentsService'
import { InsPlansService } from './generated/InsPlansService'
import { InsSubsService } from './generated/InsSubsService'
import { InsVerifiesService } from './generated/InsVerifiesService'
import { LabCasesService } from './generated/LabCasesService'
import { LaboratoriesService } from './generated/LaboratoriesService'
import { LabTurnaroundsService } from './generated/LabTurnaroundsService'
import { MedicationsService } from './generated/MedicationsService'
import { MedicationPatsService } from './generated/MedicationPatsService'
import { OperatoriesService } from './generated/OperatoriesService'
import { PatFieldDefsService } from './generated/PatFieldDefsService'
import { PatFieldsService } from './generated/PatFieldsService'
import { PatientNotesService } from './generated/PatientNotesService'
import { PatientRacesService } from './generated/PatientRacesService'
import { PatientsService } from './generated/PatientsService'
import { PatPlansService } from './generated/PatPlansService'
import { PatRestrictionsService } from './generated/PatRestrictionsService'
import { PaymentsService } from './generated/PaymentsService'
import { PayPlanChargesService } from './generated/PayPlanChargesService'
import { PayPlanLinksService } from './generated/PayPlanLinksService'
import { PayPlansService } from './generated/PayPlansService'
import { PaySplitsService } from './generated/PaySplitsService'
import { PerioExamsService } from './generated/PerioExamsService'
import { PerioMeasuresService } from './generated/PerioMeasuresService'
import { PharmaciesService } from './generated/PharmaciesService'
import { PopupsService } from './generated/PopupsService'
import { PreferencesService } from './generated/PreferencesService'
import { ProcedureCodesService } from './generated/ProcedureCodesService'
import { ProcedureLogsService } from './generated/ProcedureLogsService'
import { ProcNotesService } from './generated/ProcNotesService'
import { ProcTPsService } from './generated/ProcTPsService'
import { ProvidersService } from './generated/ProvidersService'
import { QueriesService } from './generated/QueriesService'
import { QuickPasteCatsService } from './generated/QuickPasteCatsService'
import { QuickPasteNotesService } from './generated/QuickPasteNotesService'
import { RecallsService } from './generated/RecallsService'
import { RecallTypesService } from './generated/RecallTypesService'
import { RefAttachesService } from './generated/RefAttachesService'
import { ReferralsService } from './generated/ReferralsService'
import { ReportsService } from './generated/ReportsService'
import { RxPatsService } from './generated/RxPatsService'
import { SchedulesService } from './generated/SchedulesService'
import { ScheduleOpsService } from './generated/ScheduleOpsService'
import { SecurityLogsService } from './generated/SecurityLogsService'
import { SecurityPermsService } from './generated/SecurityPermsService'
import { SheetDefsService } from './generated/SheetDefsService'
import { SheetFieldsService } from './generated/SheetFieldsService'
import { SheetFieldDefsService } from './generated/SheetFieldDefsService'
import { SheetsService } from './generated/SheetsService'
import { SignalodsService } from './generated/SignalodsService'
import { StatementsService } from './generated/StatementsService'
import { SubscriptionsService } from './generated/SubscriptionsService'
import { SubstitutionLinksService } from './generated/SubstitutionLinksService'
import { TaskListsService } from './generated/TaskListsService'
import { TaskNotesService } from './generated/TaskNotesService'
import { TasksService } from './generated/TasksService'
import { ToothInitialsService } from './generated/ToothInitialsService'
import { TreatPlanAttachesService } from './generated/TreatPlanAttachesService'
import { TreatPlansService } from './generated/TreatPlansService'
import { UserGroupAttachesService } from './generated/UserGroupAttachesService'
import { UserGroupsService } from './generated/UserGroupsService'
import { UserodsService } from './generated/UserodsService'

export type OpenDentalServices = ReturnType<typeof createServiceRegistry>

export function createServiceRegistry(client: OpenDentalClient, context: PracticeContext) {
  return {
    accountModules: new AccountModulesService(client, context),
    adjustments: new AdjustmentsService(client, context),
    allergies: new AllergiesService(client, context),
    allergyDefs: new AllergyDefsService(client, context),
    appointments: new AppointmentsService(client, context),
    appointmentTypes: new AppointmentTypesService(client, context),
    apptFieldDefs: new ApptFieldDefsService(client, context),
    apptFields: new ApptFieldsService(client, context),
    asapComms: new AsapCommsService(client, context),
    autoNoteControls: new AutoNoteControlsService(client, context),
    autoNotes: new AutoNotesService(client, context),
    benefits: new BenefitsService(client, context),
    carriers: new CarriersService(client, context),
    chartModules: new ChartModulesService(client, context),
    claimForms: new ClaimFormsService(client, context),
    claimPayments: new ClaimPaymentsService(client, context),
    claimProcs: new ClaimProcsService(client, context),
    claims: new ClaimsService(client, context),
    claimTrackings: new ClaimTrackingsService(client, context),
    clinics: new ClinicsService(client, context),
    clockEvents: new ClockEventsService(client, context),
    codeGroups: new CodeGroupsService(client, context),
    commlogs: new CommlogsService(client, context),
    computers: new ComputersService(client, context),
    covCats: new CovCatsService(client, context),
    covSpans: new CovSpansService(client, context),
    definitions: new DefinitionsService(client, context),
    deposits: new DepositsService(client, context),
    discountPlans: new DiscountPlansService(client, context),
    discountPlanSubs: new DiscountPlanSubsService(client, context),
    diseases: new DiseasesService(client, context),
    diseaseDefs: new DiseaseDefsService(client, context),
    documents: new DocumentsService(client, context),
    ehrPatients: new EhrPatientsService(client, context),
    eobAttaches: new EobAttachesService(client, context),
    employees: new EmployeesService(client, context),
    employers: new EmployersService(client, context),
    etransMessageTexts: new EtransMessageTextsService(client, context),
    etranss: new EtranssService(client, context),
    familyModules: new FamilyModulesService(client, context),
    fees: new FeesService(client, context),
    feeScheds: new FeeSchedsService(client, context),
    guardians: new GuardiansService(client, context),
    histAppointments: new HistAppointmentsService(client, context),
    insPlans: new InsPlansService(client, context),
    insSubs: new InsSubsService(client, context),
    insVerifies: new InsVerifiesService(client, context),
    labCases: new LabCasesService(client, context),
    laboratories: new LaboratoriesService(client, context),
    labTurnarounds: new LabTurnaroundsService(client, context),
    medications: new MedicationsService(client, context),
    medicationPats: new MedicationPatsService(client, context),
    operatories: new OperatoriesService(client, context),
    patFieldDefs: new PatFieldDefsService(client, context),
    patFields: new PatFieldsService(client, context),
    patientNotes: new PatientNotesService(client, context),
    patientRaces: new PatientRacesService(client, context),
    patients: new PatientsService(client, context),
    patPlans: new PatPlansService(client, context),
    patRestrictions: new PatRestrictionsService(client, context),
    payments: new PaymentsService(client, context),
    payPlanCharges: new PayPlanChargesService(client, context),
    payPlanLinks: new PayPlanLinksService(client, context),
    payPlans: new PayPlansService(client, context),
    paySplits: new PaySplitsService(client, context),
    perioExams: new PerioExamsService(client, context),
    perioMeasures: new PerioMeasuresService(client, context),
    pharmacies: new PharmaciesService(client, context),
    popups: new PopupsService(client, context),
    preferences: new PreferencesService(client, context),
    procedureCodes: new ProcedureCodesService(client, context),
    procedureLogs: new ProcedureLogsService(client, context),
    procNotes: new ProcNotesService(client, context),
    procTPs: new ProcTPsService(client, context),
    providers: new ProvidersService(client, context),
    queries: new QueriesService(client, context),
    quickPasteCats: new QuickPasteCatsService(client, context),
    quickPasteNotes: new QuickPasteNotesService(client, context),
    recalls: new RecallsService(client, context),
    recallTypes: new RecallTypesService(client, context),
    refAttaches: new RefAttachesService(client, context),
    referrals: new ReferralsService(client, context),
    reports: new ReportsService(client, context),
    rxPats: new RxPatsService(client, context),
    schedules: new SchedulesService(client, context),
    scheduleOps: new ScheduleOpsService(client, context),
    securityLogs: new SecurityLogsService(client, context),
    securityPerms: new SecurityPermsService(client, context),
    sheetDefs: new SheetDefsService(client, context),
    sheetFields: new SheetFieldsService(client, context),
    sheetFieldDefs: new SheetFieldDefsService(client, context),
    sheets: new SheetsService(client, context),
    signalods: new SignalodsService(client, context),
    statements: new StatementsService(client, context),
    subscriptions: new SubscriptionsService(client, context),
    substitutionLinks: new SubstitutionLinksService(client, context),
    taskLists: new TaskListsService(client, context),
    taskNotes: new TaskNotesService(client, context),
    tasks: new TasksService(client, context),
    toothInitials: new ToothInitialsService(client, context),
    treatPlanAttaches: new TreatPlanAttachesService(client, context),
    treatPlans: new TreatPlansService(client, context),
    userGroupAttaches: new UserGroupAttachesService(client, context),
    userGroups: new UserGroupsService(client, context),
    userods: new UserodsService(client, context),
  }
}
