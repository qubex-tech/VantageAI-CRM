/**
 * Prod integration test: verify Open Dental slot reads use reading defaults
 * and booking uses booking defaults (AFD).
 *
 * Usage: npx tsx --env-file=.env.vercel.prod scripts/test-od-read-book-defaults.ts
 */
import { prisma } from '../src/lib/db'
import { getSchedulingSettings } from '../src/lib/integrations/clinical-system/server'
import {
  resolveReadLengthMinutes,
  resolveReadOperatoryNum,
  resolveReadProvNum,
} from '../src/lib/integrations/clinical-system/types'
import { createOpenDentalPatientFromCrm } from '../src/lib/integrations/opendental/patientWriteback'
import {
  bookOpenDentalAppointment,
  getOpenDentalOpenSlots,
} from '../src/lib/integrations/opendental/scheduling'
import { getOpenDentalServices } from '../src/lib/integrations/opendental/factory'

const PRACTICE_ID = process.env.OD_TEST_PRACTICE_ID?.trim() || '6a10eff8-e984-40ab-984b-57880defe60a'
const CLEANUP = process.env.OD_TEST_SKIP_CLEANUP !== '1'

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function opName(ops: Array<{ operatoryNum: number; name: string }>, n: number | null | undefined) {
  if (!n) return '(none)'
  return ops.find((o) => o.operatoryNum === n)?.name ?? `Op#${n}`
}

async function main() {
  console.log('Open Dental read vs book defaults test')
  console.log('Practice:', PRACTICE_ID)
  console.log('='.repeat(70))

  const scheduling = await getSchedulingSettings(PRACTICE_ID)
  if (scheduling.mode !== 'open_dental') {
    throw new Error(`Practice scheduling mode is "${scheduling.mode}", expected open_dental`)
  }

  const readProv = resolveReadProvNum(scheduling)
  const readOp = resolveReadOperatoryNum(scheduling)
  const readLen = resolveReadLengthMinutes(scheduling)
  const bookProv = scheduling.defaultProvNum ?? null
  const bookOp = scheduling.defaultOperatoryNum ?? null
  const bookLen = scheduling.defaultLengthMinutes ?? null

  console.log('\n[config] Reading defaults (resolved):')
  console.log(`  provider:  ${readProv ?? '(none)'}`)
  console.log(`  operatory: ${readOp ?? '(none)'}`)
  console.log(`  length:    ${readLen ?? '(none)'} min`)
  console.log('[config] Booking defaults:')
  console.log(`  provider:  ${bookProv ?? '(none)'}`)
  console.log(`  operatory: ${bookOp ?? '(none)'}`)
  console.log(`  length:    ${bookLen ?? '(none)'} min`)

  if (!readOp) throw new Error('No read operatory resolved — configure reading or booking operatory in settings.')
  if (!bookOp) throw new Error('No booking operatory configured in settings.')

  const services = await getOpenDentalServices(PRACTICE_ID)
  const rawOps = (await services.operatories.list()) as Array<Record<string, unknown>>
  const operatories = rawOps
    .filter((o) => String(o.IsHidden).toLowerCase() !== 'true')
    .map((o) => ({ operatoryNum: Number(o.OperatoryNum), name: String(o.OpName ?? o.OperatoryNum) }))

  console.log('\n[config] Operatory names:')
  console.log(`  read  -> ${opName(operatories, readOp)} (${readOp})`)
  console.log(`  book  -> ${opName(operatories, bookOp)} (${bookOp})`)

  if (readOp === bookOp) {
    console.warn('\n  NOTE: read and book operatories are the same — test will still verify code paths but cannot distinguish by operatory.')
  }

  const stamp = Date.now()
  const testPhone = `+1555${String(stamp).slice(-7)}`
  const testName = `OD ReadBook Test ${stamp}`

  console.log('\n[1] Creating CRM test patient...')
  const patient = await prisma.patient.create({
    data: {
      practiceId: PRACTICE_ID,
      name: testName,
      firstName: 'OD',
      lastName: `ReadBookTest${stamp}`,
      phone: testPhone,
      primaryPhone: testPhone,
      dateOfBirth: new Date('1990-06-15T00:00:00.000Z'),
      preferredContactMethod: 'phone',
    },
  })
  console.log(`    patientId=${patient.id} phone=${testPhone}`)

  console.log('\n[2] Linking patient to Open Dental...')
  const odLink = await createOpenDentalPatientFromCrm({ practiceId: PRACTICE_ID, patientId: patient.id })
  if (odLink.status !== 'success' || !odLink.patNum) {
    throw new Error(`OD patient create failed: ${odLink.status} ${odLink.reason ?? ''}`)
  }
  console.log(`    PatNum=${odLink.patNum} externalEhrId=${odLink.externalEhrId}`)

  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 14)

  console.log('\n[3] Fetching slots using READ defaults...')
  const slots = await getOpenDentalOpenSlots({
    practiceId: PRACTICE_ID,
    provNum: readProv,
    opNum: readOp,
    dateStart: ymd(start),
    dateEnd: ymd(end),
    lengthMinutes: readLen,
  })
  console.log(`    ${slots.length} slot(s) returned`)
  if (slots.length === 0) {
    throw new Error('No slots returned for read operatory — cannot complete booking test.')
  }

  const sample = slots.slice(0, 5)
  const slotOpNums = new Set(slots.map((s) => s.opNum))
  sample.forEach((s) => console.log(`      • ${s.start} op=${s.opNum} prov=${s.provNum}`.trim() + ` len=${s.lengthMinutes}m`))

  const readOpOk =
    slotOpNums.size === 1 && slotOpNums.has(readOp)
      ? 'PASS'
      : slotOpNums.has(readOp)
        ? 'PARTIAL (mixed operatories in response)'
        : 'FAIL'
  console.log(`\n    Slot operatory check: ${readOpOk}`)
  console.log(`    Unique opNums in slots: ${[...slotOpNums].join(', ')} (expected read op ${readOp})`)

  const target = slots[0]
  console.log(`\n[4] Booking first slot using BOOK defaults (not slot op)...`)
  console.log(`    slot time: ${target.start} (slot op=${target.opNum})`)
  console.log(`    booking to op=${bookOp} prov=${bookProv ?? '(none)'} len=${bookLen ?? target.lengthMinutes}m`)

  const booking = await bookOpenDentalAppointment({
    practiceId: PRACTICE_ID,
    patientId: patient.id,
    provNum: bookProv,
    opNum: bookOp,
    dateTimeStart: target.start,
    lengthMinutes: bookLen ?? target.lengthMinutes,
    note: `Vantage read/book defaults test ${stamp} — cleanup safe`,
    visitType: 'Test',
  })
  console.log(`    CRM appointmentId=${booking.appointmentId} AptNum=${booking.aptNum}`)

  console.log('\n[5] Verifying appointment in Open Dental...')
  const apt = (await services.appointments.get(booking.aptNum)) as Record<string, unknown>
  const aptOp = Number(apt.Op)
  const aptProv = Number(apt.ProvNum)
  console.log(`    OD AptNum=${booking.aptNum} Op=${aptOp} ProvNum=${aptProv} time=${apt.AptDateTime} status=${apt.AptStatus}`)

  const bookOpOk = aptOp === bookOp
  const bookProvOk = !bookProv || aptProv === bookProv
  console.log(`\n    Book operatory check: ${bookOpOk ? 'PASS' : 'FAIL'} (expected ${bookOp}, got ${aptOp})`)
  if (bookProv) {
    console.log(`    Book provider check:  ${bookProvOk ? 'PASS' : 'FAIL'} (expected ${bookProv}, got ${aptProv})`)
  }

  if (CLEANUP) {
    console.log('\n[6] Cleanup — marking test appointment Broken...')
    await services.appointments.update(booking.aptNum, { AptStatus: 'Broken' })
    await prisma.appointment.update({
      where: { id: booking.appointmentId },
      data: { status: 'cancelled', notes: `Test apt ${stamp} — marked broken in OD` },
    })
    console.log('    Test patient kept in CRM (still active in Open Dental).')
  } else {
    console.log('\n[6] Cleanup skipped (OD_TEST_SKIP_CLEANUP=1)')
  }

  console.log('\n' + '='.repeat(70))
  const allPass = readOpOk.startsWith('PASS') && bookOpOk && bookProvOk
  if (allPass) {
    console.log('PASS — slots read from reading operatory; appointment written to booking operatory.')
  } else {
    console.log('RESULT — see checks above.')
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
