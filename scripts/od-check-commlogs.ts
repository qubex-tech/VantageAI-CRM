/**
 * Read commlogs for a given Open Dental PatNum to verify writeback.
 * Usage: npx tsx scripts/od-check-commlogs.ts [PatNum]
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
  console.log(`Reading commlogs for PatNum=${patNum} from ${baseUrl}`)
  console.log(`Developer key: ${developerKey.slice(0, 4)}…  Customer key: ${customerKey.slice(0, 4)}…`)

  const context = toPracticeContext({
    practiceId: 'commlog-check',
    connectionId: 'commlog-check-conn',
    displayName: 'Commlog check',
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

  const commlogs = (await services.commlogs.list({ PatNum: patNum })) as Array<Record<string, unknown>>
  if (!Array.isArray(commlogs) || commlogs.length === 0) {
    console.log('No commlogs found for this patient.')
    return
  }
  console.log(`Found ${commlogs.length} commlog(s):\n`)
  for (const c of commlogs) {
    console.log('-'.repeat(60))
    console.log(`CommlogNum     : ${c.CommlogNum}`)
    console.log(`CommDateTime   : ${c.CommDateTime}`)
    console.log(`commType       : ${c.commType ?? c.CommType}`)
    console.log(`Mode_          : ${c.Mode_}`)
    console.log(`SentOrReceived : ${c.SentOrReceived}`)
    const note = typeof c.Note === 'string' ? c.Note : ''
    console.log(`Note           : ${note.slice(0, 400)}${note.length > 400 ? '…' : ''}`)
  }
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
