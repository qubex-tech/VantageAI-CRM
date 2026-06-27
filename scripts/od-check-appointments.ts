/**
 * Read appointments for a given Open Dental PatNum to verify appointment writeback/booking.
 * Usage: npx tsx scripts/od-check-appointments.ts [PatNum]
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

async function main() {
  console.log(`Reading appointments for PatNum=${patNum} from ${baseUrl}`)

  const context = toPracticeContext({
    practiceId: 'appt-check',
    connectionId: 'appt-check-conn',
    displayName: 'Appt check',
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

  const appts = (await services.appointments.list({ PatNum: patNum })) as Array<Record<string, unknown>>
  if (!Array.isArray(appts) || appts.length === 0) {
    console.log('No appointments found for this patient.')
    return
  }
  console.log(`Found ${appts.length} appointment(s):\n`)
  for (const a of appts) {
    console.log('-'.repeat(60))
    console.log(`AptNum       : ${a.AptNum}`)
    console.log(`AptStatus    : ${a.AptStatus}`)
    console.log(`AptDateTime  : ${a.AptDateTime}`)
    console.log(`Op           : ${a.Op}   ProvNum: ${a.ProvNum} (${a.provAbbr ?? ''})`)
    console.log(`Pattern      : ${a.Pattern}`)
    const note = typeof a.Note === 'string' ? a.Note : ''
    console.log(`Note         : ${note.slice(0, 200)}`)
  }
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
