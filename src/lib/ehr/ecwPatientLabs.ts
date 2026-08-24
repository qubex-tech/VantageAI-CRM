import { prisma } from '@/lib/db'
import { discoverSmartConfiguration } from '@/lib/integrations/ehr/discovery'
import { getEcwClientAssertionAud, getPrivateKeyJwtConfig } from '@/lib/integrations/ehr/server'
import { createClientAssertion, exchangeClientCredentials } from '@/lib/integrations/ehr/smartEngine'

export const ECW_LAB_SCOPES =
  'system/Patient.read system/Observation.read system/DiagnosticReport.read system/ServiceRequest.read'

export type LabFlag = 'H' | 'L' | 'N' | null

export type LabValue = {
  test: string
  loinc?: string
  value: string
  interpretation: LabFlag
  range?: string | null
}

export type LabPanelColumn = {
  key: string
  label: string
  loinc?: string
}

export type LabResultRow = {
  key: string
  orderId?: string
  reportId?: string
  panelKey: string
  panelLabel: string
  orderDate: string | null
  authoredOn: string | null
  collectionDateTime: string | null
  resultDate: string | null
  status: string
  futureOrder: boolean
  values: Record<string, LabValue>
}

export type LabOrder = {
  id: string
  panelKey: string
  panelLabel: string
  authoredOn: string | null
  orderDate: string | null
  collectionDateTime: string | null
  resultDate: string | null
  status: string
  reviewStatus: string | null
  futureOrder: boolean
}

export type LabPanel = {
  key: string
  label: string
  columns: LabPanelColumn[]
  rows: LabResultRow[]
}

const PANEL_COLUMNS: Record<string, LabPanelColumn[]> = {
  cbc: [
    { key: 'wbc', label: 'White Blood Cell Count', loinc: '6690-2' },
    { key: 'rbc', label: 'Red Blood Cell Count', loinc: '789-8' },
    { key: 'hemoglobin', label: 'Hemoglobin', loinc: '718-7' },
    { key: 'hematocrit', label: 'Hematocrit', loinc: '4544-3' },
    { key: 'mcv', label: 'MCV', loinc: '787-2' },
    { key: 'mch', label: 'MCH', loinc: '785-6' },
    { key: 'mchc', label: 'MCHC', loinc: '786-4' },
    { key: 'rdw', label: 'RDW', loinc: '788-8' },
    { key: 'platelet', label: 'Platelet Count', loinc: '777-3' },
    { key: 'mpv', label: 'MPV' },
  ],
  cmp: [
    { key: 'glucose', label: 'Glucose', loinc: '2345-7' },
    { key: 'bun', label: 'Urea Nitrogen (BUN)', loinc: '3094-0' },
    { key: 'creatinine', label: 'Creatinine', loinc: '2160-0' },
    { key: 'egfr', label: 'eGFR' },
    { key: 'bun_cr', label: 'BUN/Creatinine Ratio' },
    { key: 'sodium', label: 'Sodium' },
    { key: 'potassium', label: 'Potassium' },
    { key: 'chloride', label: 'Chloride' },
    { key: 'co2', label: 'Carbon Dioxide' },
    { key: 'calcium', label: 'Calcium' },
    { key: 'protein', label: 'Protein, Total' },
    { key: 'albumin', label: 'Albumin' },
    { key: 'globulin', label: 'Globulin' },
    { key: 'ag_ratio', label: 'Albumin/Globulin Ratio' },
    { key: 'bili', label: 'Bilirubin, Total' },
    { key: 'alkp', label: 'Alkaline Phosphatase' },
    { key: 'ast', label: 'AST' },
    { key: 'alt', label: 'ALT' },
  ],
  hepatic: [
    { key: 'protein', label: 'Protein, Total' },
    { key: 'albumin', label: 'Albumin' },
    { key: 'globulin', label: 'Globulin' },
    { key: 'ag_ratio', label: 'Albumin/Globulin Ratio' },
    { key: 'bili', label: 'Bilirubin, Total' },
    { key: 'bili_direct', label: 'Bilirubin, Direct' },
    { key: 'alkp', label: 'Alkaline Phosphatase' },
    { key: 'ast', label: 'AST' },
    { key: 'alt', label: 'ALT' },
  ],
  crp: [{ key: 'crp', label: 'C-Reactive Protein', loinc: '1988-5' }],
  serology: [
    { key: 'ana', label: 'ANA Screen, IFA' },
    { key: 'rf', label: 'Rheumatoid Factor' },
    { key: 'ccp', label: 'CCP Ab (IgG)' },
    { key: 'hla_b27', label: 'HLA-B27 Antigen' },
  ],
}

const COLUMN_ALIASES: Array<{ key: string; match: RegExp }> = [
  { key: 'wbc', match: /^WHITE BLOOD CELL/ },
  { key: 'rbc', match: /^RED BLOOD CELL/ },
  { key: 'hemoglobin', match: /^HEMOGLOBIN$/ },
  { key: 'hematocrit', match: /^HEMATOCRIT$/ },
  { key: 'mcv', match: /^MCV$/ },
  { key: 'mch', match: /^MCH$/ },
  { key: 'mchc', match: /^MCHC$/ },
  { key: 'rdw', match: /^RDW/ },
  { key: 'platelet', match: /^PLATELET/ },
  { key: 'mpv', match: /^MPV$/ },
  { key: 'glucose', match: /^GLUCOSE$/ },
  { key: 'bun', match: /^UREA NITROGEN|^BUN$/ },
  { key: 'creatinine', match: /^CREATININE$/ },
  { key: 'egfr', match: /^EGFR/ },
  { key: 'bun_cr', match: /^BUN\/CREATININE/ },
  { key: 'sodium', match: /^SODIUM$/ },
  { key: 'potassium', match: /^POTASSIUM$/ },
  { key: 'chloride', match: /^CHLORIDE$/ },
  { key: 'co2', match: /^CARBON DIOXIDE$/ },
  { key: 'calcium', match: /^CALCIUM$/ },
  { key: 'protein', match: /^PROTEIN, TOTAL$/ },
  { key: 'albumin', match: /^ALBUMIN$/ },
  { key: 'globulin', match: /^GLOBULIN$/ },
  { key: 'ag_ratio', match: /^ALBUMIN\/GLOBULIN/ },
  { key: 'bili', match: /^BILIRUBIN, TOTAL$/ },
  { key: 'bili_direct', match: /^BILIRUBIN, DIRECT$/ },
  { key: 'alkp', match: /^ALKALINE PHOSPHATASE$/ },
  { key: 'ast', match: /^AST$/ },
  { key: 'alt', match: /^ALT$/ },
  { key: 'crp', match: /^C-REACTIVE PROTEIN/ },
  { key: 'ana', match: /^ANA SCREEN/ },
  { key: 'rf', match: /^RHEUMATOID FACTOR/ },
  { key: 'ccp', match: /CITRULLINATED|CCP/ },
  { key: 'hla_b27', match: /^HLA-B27/ },
]

type FhirBundle = {
  resourceType?: string
  entry?: Array<{ resource?: Record<string, unknown> }>
  link?: Array<{ relation?: string; url?: string }>
}

export function panelKeyFromLabel(label: string): string {
  const u = label.toUpperCase()
  if (u.includes('CBC')) return 'cbc'
  if (u.includes('COMPREHENSIVE METABOLIC') || /\bCMP\b/.test(u)) return 'cmp'
  if (u.includes('HEPATIC')) return 'hepatic'
  if (u.includes('C-REACTIVE') || /\bCRP\b/.test(u)) return 'crp'
  if (u.includes('ANA') || u.includes('RHEUMATOID') || u.includes('CCP') || u.includes('HLA-B27')) {
    return 'serology'
  }
  return 'other'
}

export function columnKeyForTest(test: string): string | null {
  const u = test.toUpperCase().trim()
  const hit = COLUMN_ALIASES.find((alias) => alias.match.test(u))
  return hit?.key || null
}

export function displayOrderDate(order: {
  occurrenceDateTime?: string | null
  authoredOn?: string | null
}): string | null {
  return order.occurrenceDateTime || order.authoredOn || null
}

export function sameLabInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && Math.abs(ta - tb) < 60_000) return true
  return a.slice(0, 16) === b.slice(0, 16)
}

export function matchOrderToReport<
  T extends {
    id: string
    panelKey: string
    collectionDateTime?: string | null
    occurrenceDateTime?: string | null
  },
>(
  orders: T[],
  report: { panelKey: string; collectionDateTime?: string | null }
): T | null {
  const samePanel = orders.filter((order) => order.panelKey === report.panelKey)
  return (
    samePanel.find((order) => sameLabInstant(order.collectionDateTime, report.collectionDateTime)) ||
    samePanel.find((order) => sameLabInstant(order.occurrenceDateTime, report.collectionDateTime)) ||
    null
  )
}

function extValue(resource: Record<string, unknown>, suffix: string): string | null {
  const extensions = Array.isArray(resource.extension) ? resource.extension : []
  for (const raw of extensions) {
    const ext = raw as { url?: string; valueDateTime?: string; valueDate?: string; valueString?: string }
    if (!String(ext.url || '').endsWith(suffix)) continue
    return ext.valueDateTime || ext.valueDate || ext.valueString || null
  }
  return null
}

function resourceCode(resource: Record<string, unknown>): string {
  const code = resource.code as { text?: string; coding?: Array<{ display?: string; code?: string }> } | undefined
  return code?.text || code?.coding?.[0]?.display || code?.coding?.[0]?.code || 'Unknown'
}

function observationValue(resource: Record<string, unknown>): string {
  const quantity = resource.valueQuantity as { value?: number; unit?: string; code?: string } | undefined
  if (quantity && quantity.value !== undefined) {
    return `${quantity.value} ${quantity.unit || quantity.code || ''}`.trim()
  }
  if (typeof resource.valueString === 'string') return resource.valueString
  const cc = resource.valueCodeableConcept as { text?: string; coding?: Array<{ display?: string }> } | undefined
  return cc?.text || cc?.coding?.[0]?.display || ''
}

function observationFlag(resource: Record<string, unknown>): LabFlag {
  const interp = resource.interpretation as Array<{
    text?: string
    coding?: Array<{ code?: string; display?: string }>
  }> | undefined
  const raw = (interp?.[0]?.coding?.[0]?.code || interp?.[0]?.text || '').toUpperCase()
  if (raw === 'H' || raw.startsWith('HIGH')) return 'H'
  if (raw === 'L' || raw.startsWith('LOW')) return 'L'
  if (raw === 'N' || raw.startsWith('NORMAL')) return 'N'
  return null
}

function observationRange(resource: Record<string, unknown>): string | null {
  const ranges = resource.referenceRange as Array<{
    text?: string
    low?: { value?: number; unit?: string }
    high?: { value?: number; unit?: string }
  }> | undefined
  const first = ranges?.[0]
  if (!first) return null
  if (first.text) return first.text
  if (first.low || first.high) {
    return `${first.low?.value ?? ''}–${first.high?.value ?? ''} ${first.high?.unit || first.low?.unit || ''}`.trim()
  }
  return null
}

function refId(reference?: string): string | null {
  if (!reference) return null
  const parts = reference.split('/')
  return parts[parts.length - 1] || null
}

async function searchFhir(
  base: string,
  token: string,
  path: string,
  maxPages = 20
): Promise<Record<string, unknown>[]> {
  const resources: Record<string, unknown>[] = []
  let next: string | null = `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const seen = new Set<string>()
  for (let i = 0; i < maxPages && next; i++) {
    if (seen.has(next)) break
    seen.add(next)
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/fhir+json' },
      cache: 'no-store',
    })
    const body = (await res.json()) as FhirBundle & { issue?: unknown }
    if (!res.ok) {
      throw new Error(`FHIR ${path} failed (${res.status}): ${JSON.stringify(body).slice(0, 400)}`)
    }
    for (const entry of body.entry || []) {
      if (entry.resource && entry.resource.resourceType !== 'OperationOutcome') {
        resources.push(entry.resource)
      }
    }
    next = (body.link || []).find((link) => link.relation === 'next')?.url || null
  }
  return resources
}

export function assembleLabPanels(input: {
  observations: Record<string, unknown>[]
  reports: Record<string, unknown>[]
  orders: Record<string, unknown>[]
}): { panels: LabPanel[]; orders: LabOrder[] } {
  const observations = new Map<string, Record<string, unknown>>()
  for (const obs of input.observations) {
    if (typeof obs.id === 'string') observations.set(obs.id, obs)
  }

  const parsedOrders = input.orders
    .filter((resource) => resource.resourceType === 'ServiceRequest')
    .map((resource) => {
      const label = resourceCode(resource)
      const key = panelKeyFromLabel(label)
      const authoredOn = typeof resource.authoredOn === 'string' ? resource.authoredOn : null
      const occurrenceDateTime =
        typeof resource.occurrenceDateTime === 'string' ? resource.occurrenceDateTime : null
      const collectionDateTime = extValue(resource, 'collectionDate')
      const resultDate = extValue(resource, 'receivedDate')
      const reviewStatus = extValue(resource, 'status')
      return {
        id: String(resource.id || ''),
        panelKey: key,
        panelLabel: label,
        authoredOn,
        occurrenceDateTime,
        orderDate: displayOrderDate({ occurrenceDateTime, authoredOn }),
        collectionDateTime,
        resultDate,
        status: typeof resource.status === 'string' ? resource.status : 'unknown',
        reviewStatus,
        futureOrder: reviewStatus === 'Open' || (!collectionDateTime && resource.status === 'active'),
      }
    })

  const rows: LabResultRow[] = []
  for (const report of input.reports) {
    if (report.resourceType !== 'DiagnosticReport' || typeof report.id !== 'string') continue
    const label = resourceCode(report)
    const key = panelKeyFromLabel(label)
    const collectionDateTime =
      typeof report.effectiveDateTime === 'string' ? report.effectiveDateTime : null
    const issued = typeof report.issued === 'string' ? report.issued : null
    const matched = matchOrderToReport(parsedOrders, { panelKey: key, collectionDateTime })
    const resultRefs = Array.isArray(report.result) ? report.result : []
    const values: Record<string, LabValue> = {}
    for (const ref of resultRefs) {
      const id = refId((ref as { reference?: string }).reference)
      const obs = id ? observations.get(id) : undefined
      if (!obs) continue
      const test = resourceCode(obs)
      const columnKey = columnKeyForTest(test)
      if (!columnKey) continue
      values[columnKey] = {
        test,
        loinc:
          (obs.code as { coding?: Array<{ system?: string; code?: string }> } | undefined)?.coding?.find((c) =>
            String(c.system || '').toLowerCase().includes('loinc')
          )?.code,
        value: observationValue(obs),
        interpretation: observationFlag(obs),
        range: observationRange(obs),
      }
    }

    rows.push({
      key: `report:${report.id}`,
      orderId: matched?.id,
      reportId: report.id,
      panelKey: key,
      panelLabel: label,
      orderDate: matched?.orderDate || collectionDateTime,
      authoredOn: matched?.authoredOn || null,
      collectionDateTime,
      resultDate: matched?.resultDate || issued,
      status: matched?.reviewStatus || (typeof report.status === 'string' ? report.status : 'final'),
      futureOrder: false,
      values,
    })
  }

  const reportedOrderIds = new Set(rows.map((row) => row.orderId).filter(Boolean))
  for (const order of parsedOrders) {
    if (reportedOrderIds.has(order.id) || !order.futureOrder) continue
    rows.push({
      key: `order:${order.id}`,
      orderId: order.id,
      panelKey: order.panelKey,
      panelLabel: order.panelLabel,
      orderDate: order.orderDate,
      authoredOn: order.authoredOn,
      collectionDateTime: order.collectionDateTime,
      resultDate: order.resultDate,
      status: order.reviewStatus || order.status,
      futureOrder: true,
      values: {},
    })
  }

  const grouped = new Map<string, LabResultRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.panelKey) || []
    list.push(row)
    grouped.set(row.panelKey, list)
  }

  const panels: LabPanel[] = []
  for (const [key, list] of grouped) {
    list.sort((a, b) => String(b.collectionDateTime || b.orderDate || '').localeCompare(String(a.collectionDateTime || a.orderDate || '')))
    const extraKeys = new Set<string>()
    for (const row of list) {
      for (const columnKey of Object.keys(row.values)) extraKeys.add(columnKey)
    }
    const catalog = PANEL_COLUMNS[key] || []
    const columns = [
      ...catalog.filter((column) => extraKeys.has(column.key) || list.some((row) => row.values[column.key])),
      ...[...extraKeys]
        .filter((columnKey) => !catalog.some((column) => column.key === columnKey))
        .map((columnKey) => ({ key: columnKey, label: columnKey })),
    ]
    if (key === 'other' && extraKeys.size === 0) continue
    panels.push({
      key,
      label: list[0]?.panelLabel || key.toUpperCase(),
      columns: columns.length ? columns : catalog,
      rows: list,
    })
  }

  panels.sort((a, b) => {
    const rank = ['cbc', 'cmp', 'crp', 'hepatic', 'serology', 'other']
    return rank.indexOf(a.key) - rank.indexOf(b.key)
  })

  return {
    panels,
    orders: parsedOrders.sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || ''))),
  }
}

export async function fetchEcwPatientLabs(params: {
  practiceId: string
  externalEhrId: string
}): Promise<{ panels: LabPanel[]; orders: LabOrder[] }> {
  const connection = await prisma.ehrConnection.findFirst({
    where: {
      tenantId: params.practiceId,
      providerId: 'ecw_write',
      authFlow: 'backend_services',
      status: { in: ['connected', 'error', 'expired'] },
    },
    orderBy: { updatedAt: 'desc' },
    select: { clientId: true, issuer: true, fhirBaseUrl: true },
  })
  if (!connection?.clientId || !connection.issuer) {
    throw new Error('No eCW write connection for this practice')
  }

  const discovery = await discoverSmartConfiguration(connection.issuer)
  const privateKey = getPrivateKeyJwtConfig('ecw_write')
  if (!privateKey) {
    throw new Error('EHR_JWT_PRIVATE_KEY is not configured')
  }
  const assertion = createClientAssertion({
    clientId: connection.clientId,
    tokenEndpoint: discovery.tokenEndpoint,
    privateKeyPem: privateKey.privateKeyPem,
    keyId: privateKey.keyId,
    audience: getEcwClientAssertionAud(connection.issuer),
  })
  const token = await exchangeClientCredentials({
    tokenEndpoint: discovery.tokenEndpoint,
    clientId: connection.clientId,
    clientAssertion: assertion,
    scopes: ECW_LAB_SCOPES,
  })

  const base = (connection.fhirBaseUrl || discovery.fhirBaseUrl).replace(/\/+$/, '')
  const patient = encodeURIComponent(params.externalEhrId)
  const [observations, reports, orders] = await Promise.all([
    searchFhir(base, token.access_token, `/Observation?patient=${patient}&category=laboratory`),
    searchFhir(base, token.access_token, `/DiagnosticReport?patient=${patient}&category=laboratory`),
    searchFhir(base, token.access_token, `/ServiceRequest?patient=${patient}`),
  ])

  return assembleLabPanels({ observations, reports, orders })
}
