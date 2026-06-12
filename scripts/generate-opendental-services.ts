/**
 * Generates domain service classes from capability-matrix.json
 * Run: npx tsx scripts/generate-opendental-services.ts
 */
import fs from 'fs'
import path from 'path'

type CapabilityOperation = {
  resource: string
  operation: string
  httpMethod: string
  path: string
}

type Matrix = {
  operations: CapabilityOperation[]
  resources: string[]
}

const root = path.resolve(__dirname, '..')
const matrixPath = path.join(root, 'packages/opendental-sdk/src/capability-matrix.json')
const servicesDir = path.join(root, 'packages/opendental-sdk/src/services/generated')

const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as Matrix

function resourceToPath(resource: string): string {
  const special: Record<string, string> = {
    AccountModules: 'accountmodules',
    ChartModules: 'chartmodules',
    FamilyModules: 'familymodules',
    ProcedureLogs: 'procedurelogs',
    ProcedureCodes: 'procedurecodes',
    HistAppointments: 'histappointments',
    EhrPatients: 'ehrpatients',
    EobAttaches: 'eobattaches',
    EtransMessageTexts: 'etransmessagetexts',
    Etranss: 'etranss',
    InsPlans: 'insplans',
    InsSubs: 'inssubs',
    InsVerifies: 'insverifies',
    PatPlans: 'patplans',
    PatFields: 'patfields',
    PatFieldDefs: 'patfielddefs',
    PatRestrictions: 'patrestrictions',
    PatientNotes: 'patientnotes',
    PatientRaces: 'patientraces',
    PayPlans: 'payplans',
    PayPlanLinks: 'payplanlinks',
    PayPlanCharges: 'payplancharges',
    PaySplits: 'paysplits',
    ProcNotes: 'procnotes',
    ProcTPs: 'proctps',
    ClaimProcs: 'claimprocs',
    ClaimPayments: 'claimpayments',
    ClaimForms: 'claimforms',
    ClaimTrackings: 'claimtrackings',
    DiscountPlans: 'discountplans',
    DiscountPlanSubs: 'discountplansubs',
    DiseaseDefs: 'diseasedefs',
    AllergyDefs: 'allergydefs',
    ApptFieldDefs: 'apptfielddefs',
    ApptFields: 'apptfields',
    AppointmentTypes: 'appointmenttypes',
    AsapComms: 'asapcomms',
    AutoNoteControls: 'autonotecontrols',
    AutoNotes: 'autonotes',
    CodeGroups: 'codegroups',
    CovCats: 'covcats',
    CovSpans: 'covspans',
    ClockEvents: 'clockevents',
    FeeScheds: 'feescheds',
    LabCases: 'labcases',
    LabTurnarounds: 'labturnarounds',
    MedicationPats: 'medicationpats',
    PerioExams: 'perioexams',
    PerioMeasures: 'periomeasures',
    QuickPasteCats: 'quickpastecats',
    QuickPasteNotes: 'quickpastenotes',
    RecallTypes: 'recalltypes',
    RefAttaches: 'refattaches',
    RxPats: 'rxpats',
    SecurityLogs: 'securitylogs',
    SecurityPerms: 'securityperms',
    ScheduleOps: 'scheduleops',
    SheetDefs: 'sheetdefs',
    SheetFields: 'sheetfields',
    SheetFieldDefs: 'sheetfielddefs',
    Signalods: 'signalods',
    TaskLists: 'tasklists',
    TaskNotes: 'tasknotes',
    ToothInitials: 'toothinitials',
    TreatPlans: 'treatplans',
    TreatPlanAttaches: 'treatplanattaches',
    UserGroupAttaches: 'usergroupattaches',
    UserGroups: 'usergroups',
    Userods: 'userods',
    SubstitutionLinks: 'substitutionlinks',
    Queries: 'queries',
    Reports: 'reports',
  }
  if (special[resource]) return special[resource]
  return resource.charAt(0).toLowerCase() + resource.slice(1).toLowerCase()
}

function pathToMethodSuffix(op: CapabilityOperation, resourcePath: string): { methodName: string; subPath: string; hasId: boolean } {
  if (op.operation === 'GetSingle') {
    return { methodName: 'get', subPath: '{id}', hasId: true }
  }
  if (op.operation === 'Get' && op.httpMethod === 'GET') {
    return { methodName: 'list', subPath: '', hasId: false }
  }

  const methodName = op.operation.charAt(0).toLowerCase() + op.operation.slice(1)
  let subPath = op.path
    .replace(new RegExp(`^/${resourcePath}`, 'i'), '')
    .replace(/^\//, '')
    .replace(/\{id\}/g, '')

  if (subPath.startsWith('/')) subPath = subPath.slice(1)
  return { methodName, subPath, hasId: op.path.includes('{id}') && op.httpMethod !== 'GET' }
}

function generateServiceClass(resource: string, operations: CapabilityOperation[]): string {
  const className = `${resource}Service`
  const resourcePath = resourceToPath(resource)
  const methods: string[] = []
  const seenMethods = new Set<string>()

  const reserved = new Set(['getList', 'getSingle', 'getSubResource', 'createRecord', 'updateRecord', 'removeRecord', 'postAction', 'listPaginated', 'removeSubResource', 'updateSubResource', 'buildPath', 'getPracticeId'])

  for (const op of operations) {
    const { methodName, subPath, hasId } = pathToMethodSuffix(op, resourcePath)
    let finalMethodName = methodName
    let counter = 2
    while (seenMethods.has(finalMethodName) || reserved.has(finalMethodName)) {
      finalMethodName = `${methodName}${counter++}`
    }
    seenMethods.add(finalMethodName)

    const params: string[] = []
    const bodyParam = op.httpMethod === 'POST' || op.httpMethod === 'PUT' ? 'body: Record<string, unknown>' : null
    if (hasId && op.httpMethod !== 'GET') params.push('id: string | number')
    if (op.httpMethod === 'GET') {
      if (op.operation === 'GetSingle') {
        params.push('id: string | number')
        params.push('params?: Record<string, string | number | boolean | undefined>')
      } else {
        params.push('params?: Record<string, string | number | boolean | undefined | null>')
      }
    }
    if (bodyParam) params.push(bodyParam)

    const paramStr = params.join(', ')
    let body: string

    switch (op.httpMethod) {
      case 'GET':
        if (op.operation === 'GetSingle') {
          body = `return this.getSingle<Record<string, unknown>>(id, params)`
        } else if (subPath) {
          body = `return this.getSubResource<Record<string, unknown>>('${subPath}', params)`
        } else {
          body = `return this.getList<Record<string, unknown>>(params)`
        }
        break
      case 'POST':
        body = subPath
          ? `return this.postAction<Record<string, unknown>>('${subPath}', body)`
          : `return this.createRecord<Record<string, unknown>>(body)`
        break
      case 'PUT':
        body = hasId
          ? `return this.updateRecord(id, body)`
          : `return this.updateSubResource<Record<string, unknown>>('${subPath}', body)`
        break
      case 'DELETE':
        body = hasId ? `return this.removeRecord(id)` : `return this.removeSubResource('${subPath}')`
        break
      default:
        continue
    }

    methods.push(`
  /** ${op.httpMethod} ${op.path} */
  async ${finalMethodName}(${paramStr}): Promise<unknown> {
    ${body}
  }`)
  }

  return `import { BaseDomainService } from '../base/BaseDomainService'

/** Open Dental ${resource} API */
export class ${className} extends BaseDomainService {
  protected readonly resourcePath = '${resourcePath}'
${methods.join('\n')}
}
`
}

fs.mkdirSync(servicesDir, { recursive: true })

const byResource = new Map<string, CapabilityOperation[]>()
for (const op of matrix.operations) {
  const list = byResource.get(op.resource) ?? []
  list.push(op)
  byResource.set(op.resource, list)
}

const exports: string[] = []
for (const resource of matrix.resources) {
  const ops = byResource.get(resource) ?? []
  const content = generateServiceClass(resource, ops)
  fs.writeFileSync(path.join(servicesDir, `${resource}Service.ts`), content)
  exports.push(`export { ${resource}Service } from './generated/${resource}Service'`)
}

const indexContent = `${exports.join('\n')}

export { BaseDomainService } from './base/BaseDomainService'
export { createServiceRegistry, type OpenDentalServices } from './ServiceRegistry'
`

fs.writeFileSync(path.join(root, 'packages/opendental-sdk/src/services/index.ts'), indexContent)
console.log(`Generated ${matrix.resources.length} domain service classes`)
