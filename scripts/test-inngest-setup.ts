/**
 * Test script to verify Inngest setup
 * 
 * Run with: npx tsx scripts/test-inngest-setup.ts
 */

import { PrismaClient } from '@prisma/client'
import { inngest } from '../src/inngest/client'

const prisma = new PrismaClient()

async function testInngestSetup() {
  console.log('🧪 Testing Inngest Setup...\n')

  // 1. Check environment variables
  console.log('1. Checking environment variables...')
  const eventKey = process.env.INNGEST_EVENT_KEY
  const signingKey = process.env.INNGEST_SIGNING_KEY

  if (eventKey) {
    console.log('   ✅ INNGEST_EVENT_KEY is set')
  } else {
    console.log('   ⚠️  INNGEST_EVENT_KEY is not set (optional for dev)')
  }

  if (signingKey) {
    console.log('   ✅ INNGEST_SIGNING_KEY is set')
  } else {
    console.log('   ⚠️  INNGEST_SIGNING_KEY is not set (optional for dev)')
  }

  // 2. Check database connection
  console.log('\n2. Checking database connection...')
  try {
    await prisma.$connect()
    console.log('   ✅ Database connected')
  } catch (error) {
    console.log('   ❌ Database connection failed:', error)
    return
  }

  // 3. Check outbox events table
  console.log('\n3. Checking outbox events...')
  try {
    const pendingCount = await prisma.outboxEvent.count({
      where: { status: 'pending' },
    })
    const publishedCount = await prisma.outboxEvent.count({
      where: { status: 'published' },
    })
    const failedCount = await prisma.outboxEvent.count({
      where: { status: 'failed' },
    })

    console.log(`   📊 Pending: ${pendingCount}`)
    console.log(`   📊 Published: ${publishedCount}`)
    console.log(`   📊 Failed: ${failedCount}`)
  } catch (error) {
    console.log('   ❌ Error querying outbox events:', error)
  }

  // 4. Check automation rules
  console.log('\n4. Checking automation rules...')
  try {
    const rulesCount = await prisma.automationRule.count()
    const enabledRulesCount = await prisma.automationRule.count({
      where: { enabled: true },
    })

    console.log(`   📊 Total rules: ${rulesCount}`)
    console.log(`   📊 Enabled rules: ${enabledRulesCount}`)
  } catch (error) {
    console.log('   ❌ Error querying automation rules:', error)
  }

  // 5. Test Inngest client
  console.log('\n5. Testing Inngest client...')
  try {
    // Try to send a test event
    await inngest.send({
      name: 'test/setup-check',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    })
    console.log('   ✅ Test event sent to Inngest')
    console.log('   💡 Check your Inngest dashboard to see if it was received')
  } catch (error) {
    console.log('   ⚠️  Could not send test event:', error)
    console.log('   💡 Make sure Inngest dev server is running: npx inngest-cli@latest dev')
  }

  // 6. Check automation runs
  console.log('\n6. Checking automation runs...')
  try {
    const runsCount = await prisma.automationRun.count()
    const recentRuns = await prisma.automationRun.findMany({
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: {
        rule: {
          select: {
            name: true,
          },
        },
      },
    })

    console.log(`   📊 Total runs: ${runsCount}`)
    if (recentRuns.length > 0) {
      console.log('   📊 Recent runs:')
      recentRuns.forEach((run) => {
        console.log(`      - ${run.rule?.name || 'Unknown'}: ${run.status} (${run.startedAt.toISOString()})`)
      })
    }
  } catch (error) {
    console.log('   ❌ Error querying automation runs:', error)
  }

  console.log('\n✅ Setup check complete!')
  console.log('\n📝 Next steps:')
  console.log('   1. Make sure Inngest dev server is running: npx inngest-cli@latest dev')
  console.log('   2. Visit http://localhost:8288 to see the Inngest dashboard')
  console.log('   3. Create an automation rule at /settings/automations')
  console.log('   4. Test it by creating an event or clicking the "Test" button')

  await prisma.$disconnect()
}

testInngestSetup().catch(console.error)

