/**
 * Open Dental sandbox connectivity test.
 *
 * Drives the @vantage/opendental-sdk against Open Dental's public test database
 * to prove the end-to-end integration flow (auth -> validate -> health -> reads)
 * without needing the Next.js dev server, a login session, or a local DB.
 *
 * Usage:
 *   npx tsx scripts/opendental-sandbox-test.ts
 *
 * By default it uses the SDK's built-in public TEST_CREDENTIALS. To test a real
 * customer key instead, set OPEN_DENTAL_DEVELOPER_KEY + OD_TEST_CUSTOMER_KEY.
 */
import {
  OpenDentalClient,
  TEST_CREDENTIALS,
  checkConnectionHealth,
  createServiceRegistry,
  toPracticeContext,
  validateConnection,
} from '@vantage/opendental-sdk'

const developerKey = process.env.OPEN_DENTAL_DEVELOPER_KEY?.trim() || TEST_CREDENTIALS.developerKey
const customerKey = process.env.OD_TEST_CUSTOMER_KEY?.trim() || TEST_CREDENTIALS.customerKey
const baseUrl =
  process.env.OPEN_DENTAL_DEFAULT_BASE_URL?.trim() || 'https://api.opendental.com/api/v1'

const usingTestKeys = developerKey === TEST_CREDENTIALS.developerKey

function line() {
  console.log('-'.repeat(60))
}

function preview(value: unknown, max = 3): string {
  if (Array.isArray(value)) {
    return `Array(${value.length}) ${JSON.stringify(value.slice(0, max), null, 0)}`
  }
  return JSON.stringify(value)
}

async function main() {
  line()
  console.log('Open Dental sandbox connectivity test')
  line()
  console.log(`Base URL        : ${baseUrl}`)
  console.log(`Developer key   : ${developerKey.slice(0, 4)}… (${usingTestKeys ? 'public test key' : 'custom from env'})`)
  console.log(`Customer key    : ${customerKey.slice(0, 4)}…`)
  line()

  const context = toPracticeContext({
    practiceId: 'sandbox-local-test',
    connectionId: 'sandbox-conn',
    displayName: 'Sandbox',
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

  // 1. Validate (GET /clinics)
  const validation = await validateConnection(client)
  console.log(`1. validateConnection : ${validation.valid ? 'PASS' : 'FAIL'} — ${validation.message}`)
  if (!validation.valid) {
    console.log('\nStopping: connection did not validate. Check keys / base URL.')
    process.exitCode = 1
    return
  }

  // 2. Health check (GET /preferences?PrefName=ProgramVersion)
  const health = await checkConnectionHealth(client, context)
  console.log(
    `2. checkConnectionHealth : ${health.status} — OD version ${health.odVersion ?? 'unknown'} (${health.latencyMs}ms)`
  )

  // 3. Sample reads via the service registry (mirrors the CRM smoke test + more)
  const services = createServiceRegistry(client, context)

  const clinics = await services.clinics.list()
  console.log(`3. clinics.list()        : ${preview(clinics)}`)

  const patients = await services.patients.list({ Limit: 3, Offset: 0 })
  console.log(`4. patients.list(Limit=3): ${preview(patients)}`)

  const appointments = await services.appointments.list({ Limit: 3, Offset: 0 })
  console.log(`5. appointments.list()   : ${preview(appointments)}`)

  line()
  console.log('All checks completed. The SDK + auth + reads are working end-to-end.')
  line()
}

main().catch((error) => {
  console.error('\nUnexpected failure:')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
