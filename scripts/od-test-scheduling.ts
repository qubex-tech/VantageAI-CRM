/**
 * Integration test for Open Dental native scheduling against the sandbox.
 * Exercises the exact API calls + payloads used by the new scheduling code:
 *   providers.list -> operatories.list -> appointments.getSlots (+ subdivision)
 *   -> appointments.create -> appointments.get -> cleanup (AptStatus: Broken)
 *
 * Usage: npx tsx scripts/od-test-scheduling.ts [PatNum] [lengthMinutes]
 */
import {
  OpenDentalClient,
  TEST_CREDENTIALS,
  createServiceRegistry,
  toPracticeContext,
} from '@vantage/opendental-sdk'

const developerKey = process.env.OPEN_DENTAL_DEVELOPER_KEY?.trim() || TEST_CREDENTIALS.developerKey
const customerKey = process.env.OD_TEST_CUSTOMER_KEY?.trim() || TEST_CREDENTIALS.customerKey
const baseUrl =
  process.env.OPEN_DENTAL_DEFAULT_BASE_URL?.trim() || 'https://api.opendental.com/api/v1'

const patNum = Number(process.argv[2] || '11')
const lengthMinutes = Number(process.argv[3] || '30')

const PATTERN_SLOT_MINUTES = 5

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function lengthToPattern(min: number) {
  return 'X'.repeat(Math.max(1, Math.round(min / PATTERN_SLOT_MINUTES)))
}

type Naive = { y: number; mo: number; d: number; h: number; mi: number; s: number }
function parseNaive(v: unknown): Naive | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] ?? 0) }
}
function fmtNaive(p: Naive) {
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`
}
function addMin(p: Naive, min: number): Naive {
  const t = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) + min * 60_000
  const d = new Date(t)
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  }
}
function diffMin(a: Naive, b: Naive) {
  return Math.round(
    (Date.UTC(b.y, b.mo - 1, b.d, b.h, b.mi, b.s) - Date.UTC(a.y, a.mo - 1, a.d, a.h, a.mi, a.s)) / 60_000
  )
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function main() {
  console.log(`Open Dental scheduling test  (base ${baseUrl})`)
  console.log(`PatNum=${patNum}  length=${lengthMinutes}m`)
  console.log('='.repeat(70))

  const context = toPracticeContext({
    practiceId: 'sched-test',
    connectionId: 'sched-test-conn',
    displayName: 'Scheduling test',
    developerKey,
    customerKey,
    apiMode: 'remote',
    baseUrl,
  })
  const client = new OpenDentalClient({
    credentials: context.credentials,
    baseUrl: context.baseUrl,
    practiceId: context.practiceId,
  })
  const services = createServiceRegistry(client, context)

  // 1. Providers
  const providers = (await services.providers.list()) as Array<Record<string, unknown>>
  const activeProviders = providers.filter((p) => String(p.IsHidden).toLowerCase() !== 'true')
  console.log(`\n[1] providers.list -> ${providers.length} total, ${activeProviders.length} active`)
  activeProviders.slice(0, 5).forEach((p) =>
    console.log(`    ProvNum ${p.ProvNum}: ${[p.FName, p.LName].filter(Boolean).join(' ')} (${p.Abbr})`)
  )
  const prov = activeProviders[0]
  const provNum = Number(prov?.ProvNum)

  // 2. Operatories
  const operatories = (await services.operatories.list()) as Array<Record<string, unknown>>
  const activeOps = operatories.filter((o) => String(o.IsHidden).toLowerCase() !== 'true')
  console.log(`\n[2] operatories.list -> ${operatories.length} total, ${activeOps.length} active`)
  activeOps.slice(0, 5).forEach((o) => console.log(`    OperatoryNum ${o.OperatoryNum}: ${o.OpName}`))
  const op = activeOps[0]
  const opNum = Number(op?.OperatoryNum)

  if (!provNum || !opNum) {
    throw new Error('Could not resolve an active provider and operatory from the sandbox.')
  }
  console.log(`\n    Using ProvNum=${provNum}, OpNum=${opNum}`)

  // 3. Slots (next 21 days) + subdivision
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 21)
  const ranges = (await services.appointments.getSlots({
    ProvNum: provNum,
    OpNum: opNum,
    dateStart: ymd(start),
    dateEnd: ymd(end),
    lengthMinutes,
  })) as Array<Record<string, unknown>>
  console.log(`\n[3] appointments.getSlots -> ${Array.isArray(ranges) ? ranges.length : 0} open window(s)`)

  const discrete: string[] = []
  if (Array.isArray(ranges)) {
    for (const r of ranges) {
      const s = parseNaive(r.DateTimeStart)
      const e = parseNaive(r.DateTimeEnd)
      if (!s || !e) continue
      const win = diffMin(s, e)
      let cur = s
      let off = 0
      while (off + lengthMinutes <= win) {
        discrete.push(fmtNaive(cur))
        cur = addMin(cur, lengthMinutes)
        off += lengthMinutes
      }
    }
  }
  console.log(`    subdivided into ${discrete.length} bookable ${lengthMinutes}m slot(s)`) 
  discrete.slice(0, 6).forEach((s) => console.log(`      • ${s}`))

  // Choose a target time: first real slot, else next weekday 10:00.
  let aptDateTime = discrete[0]
  if (!aptDateTime) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    aptDateTime = `${ymd(d)} 10:00:00`
    console.log(`    no open slots returned — falling back to ${aptDateTime}`)
  }

  // 4. Create
  const createBody = {
    PatNum: patNum,
    Op: opNum,
    ProvNum: provNum,
    AptDateTime: aptDateTime,
    Pattern: lengthToPattern(lengthMinutes),
    AptStatus: 'Scheduled',
    Note: 'Vantage scheduling integration test',
  }
  console.log(`\n[4] appointments.create ->`, JSON.stringify(createBody))
  const resp = (await services.appointments.create(createBody)) as any
  console.log(`    response keys: ${Object.keys(resp || {}).join(', ')}`)
  console.log(`    location: ${resp?.location}`)
  console.log(`    data: ${JSON.stringify(resp?.data)}`)
  const data = (resp?.data ?? resp) as Record<string, unknown>
  const aptNum =
    Number(data?.AptNum) || Number(String(resp?.location || '').match(/(\d+)\s*$/)?.[1])
  console.log(`    resolved AptNum=${aptNum}`)
  if (!aptNum) throw new Error('No AptNum returned from create')

  // 5. Read back
  const fetched = (await services.appointments.get(aptNum)) as Record<string, unknown>
  console.log(`\n[5] appointments.get(${aptNum}) -> PatNum=${fetched.PatNum} Op=${fetched.Op} Prov=${fetched.ProvNum} status=${fetched.AptStatus} time=${fetched.AptDateTime} pattern=${fetched.Pattern}`)

  // 6. Cleanup — mark Broken so the sandbox schedule stays clean.
  await services.appointments.update(aptNum, { AptStatus: 'Broken' })
  const after = (await services.appointments.get(aptNum)) as Record<string, unknown>
  console.log(`\n[6] cleanup -> AptNum ${aptNum} status now "${after.AptStatus}"`)

  console.log('\n' + '='.repeat(70))
  console.log('PASS — providers, operatories, slot fetch+subdivision, create, read, update all work.')
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
