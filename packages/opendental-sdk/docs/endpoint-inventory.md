# Open Dental Endpoint Inventory

Source of truth: `src/capability-matrix.json`

- **Total operations:** 347
- **Resource groups:** 105
- **Documentation:** https://www.opendental.com/site/apipermissions.html

## Resources

AccountModules, Adjustments, Allergies, AllergyDefs, Appointments, AppointmentTypes, ApptFieldDefs, ApptFields, AsapComms, AutoNoteControls, AutoNotes, Benefits, Carriers, ChartModules, ClaimForms, ClaimProcs, ClaimPayments, Claims, ClaimTrackings, Clinics, ClockEvents, CodeGroups, Commlogs, Computers, CovCats, CovSpans, Definitions, Deposits, DiscountPlans, DiscountPlanSubs, Diseases, DiseaseDefs, Documents, EhrPatients, EobAttaches, Employees, Employers, EtransMessageTexts, Etranss, FamilyModules, Fees, FeeScheds, Guardians, HistAppointments, InsPlans, InsSubs, InsVerifies, LabCases, Laboratories, LabTurnarounds, Medications, MedicationPats, Operatories, PatFieldDefs, PatFields, PatientNotes, PatientRaces, Patients, PatPlans, PatRestrictions, Payments, PayPlanCharges, PayPlanLinks, PayPlans, PaySplits, PerioExams, PerioMeasures, Pharmacies, Popups, Preferences, ProcedureCodes, ProcedureLogs, ProcNotes, ProcTPs, Providers, QuickPasteCats, QuickPasteNotes, Recalls, RecallTypes, RefAttaches, Referrals, Reports, RxPats, SecurityLogs, SecurityPerms, ScheduleOps, Schedules, SheetDefs, Sheets, SheetFieldDefs, SheetFields, Signalods, Statements, Subscriptions, SubstitutionLinks, TaskLists, TaskNotes, Tasks, ToothInitials, TreatPlanAttaches, TreatPlans, UserGroupAttaches, UserGroups, Userods, Queries

## Supported operations by domain

See [capability-matrix.md](./capability-matrix.md) for the full CRUD matrix.

## Regenerating

```bash
npx tsx scripts/generate-opendental-capability-matrix.ts
npx tsx scripts/generate-opendental-services.ts
```
