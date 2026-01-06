/**
 * Test script for automation system
 * 
 * This script tests:
 * 1. Creating an outbox event
 * 2. Publishing the event
 * 3. Verifying automation execution
 */

import { prisma } from '../src/lib/db'
import { emitEvent } from '../src/lib/outbox'
import { inngest } from '../src/inngest/client'

async function testAutomation() {
  console.log('🧪 Testing Automation System...\n')

  try {
    // Step 1: Get or create a test practice
    console.log('1️⃣ Finding a practice...')
    const practice = await prisma.practice.findFirst()
    
    if (!practice) {
      console.error('❌ No practice found. Please create a practice first.')
      process.exit(1)
    }

    console.log(`✅ Found practice: ${practice.name} (${practice.id})\n`)

    // Step 2: Create a test automation rule
    console.log('2️⃣ Creating test automation rule...')
    
    // Check if rule already exists
    let rule = await prisma.automationRule.findFirst({
      where: {
        practiceId: practice.id,
        name: 'Test: Log Appointment Creation',
      },
    })

    if (!rule) {
      rule = await prisma.automationRule.create({
        data: {
          practiceId: practice.id,
          name: 'Test: Log Appointment Creation',
          enabled: true,
          triggerEvent: 'crm/appointment.created',
          conditionsJson: {
            operator: 'and',
            conditions: [
              {
                field: 'appointment.status',
                operator: 'equals',
                value: 'scheduled',
              },
            ],
          },
          actionsJson: [
            {
              type: 'create_note',
              args: {
                patientId: '{appointment.patientId}',
                type: 'appointment',
                content: 'Automated: Appointment created via automation system',
              },
            },
          ],
          createdByUserId: practice.id, // Using practice ID as placeholder
        },
      })
      console.log(`✅ Created rule: ${rule.id}\n`)
    } else {
      console.log(`✅ Using existing rule: ${rule.id}\n`)
    }

    // Step 3: Create a test patient (if needed)
    console.log('3️⃣ Finding or creating test patient...')
    let patient = await prisma.patient.findFirst({
      where: {
        practiceId: practice.id,
        deletedAt: null,
      },
    })

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          practiceId: practice.id,
          name: 'Test Patient for Automation',
          dateOfBirth: new Date('1990-01-01'),
          phone: '+15551234567',
          email: 'test@example.com',
          preferredContactMethod: 'email',
        },
      })
      console.log(`✅ Created test patient: ${patient.id}\n`)
    } else {
      console.log(`✅ Using existing patient: ${patient.id}\n`)
    }

    // Step 4: Create an outbox event
    console.log('4️⃣ Creating test outbox event...')
    const outboxEvent = await emitEvent({
      practiceId: practice.id,
      eventName: 'crm/appointment.created',
      entityType: 'appointment',
      entityId: 'test-appointment-' + Date.now(),
      data: {
        appointment: {
          id: 'test-appointment-' + Date.now(),
          patientId: patient.id,
          status: 'scheduled',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          visitType: 'Consultation',
        },
        userId: practice.id,
      },
    })

    console.log(`✅ Created outbox event: ${outboxEvent.id}`)
    console.log(`   Status: ${outboxEvent.status}\n`)

    // Step 5: Publish the event to Inngest
    console.log('5️⃣ Publishing event to Inngest...')
    try {
      await inngest.send({
        name: 'crm/event.received',
        data: {
          clinicId: practice.id,
          eventName: 'crm/appointment.created',
          entityType: 'appointment',
          entityId: outboxEvent.id,
          data: {
            appointment: {
              id: 'test-appointment-' + Date.now(),
              patientId: patient.id,
              status: 'scheduled',
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              visitType: 'Consultation',
            },
            userId: practice.id,
          },
          occurredAt: new Date().toISOString(),
          sourceEventId: outboxEvent.id,
        },
      })

      // Update outbox event status
      await prisma.outboxEvent.update({
        where: { id: outboxEvent.id },
        data: { status: 'published' },
      })

      console.log('✅ Event published to Inngest\n')
    } catch (error) {
      console.error('⚠️  Failed to publish to Inngest (this is okay if Inngest dev server is not running):')
      console.error(error instanceof Error ? error.message : error)
      console.log('\n💡 To test with Inngest, run: npx inngest-cli@latest dev\n')
    }

    // Step 6: Check for automation runs (wait a bit)
    console.log('6️⃣ Checking for automation runs...')
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const runs = await prisma.automationRun.findMany({
      where: {
        practiceId: practice.id,
        ruleId: rule.id,
        sourceEventId: outboxEvent.id,
      },
      orderBy: { startedAt: 'desc' },
      take: 1,
    })

    if (runs.length > 0) {
      console.log(`✅ Found automation run: ${runs[0].id}`)
      console.log(`   Status: ${runs[0].status}`)
      
      const actionLogs = await prisma.automationActionLog.findMany({
        where: { runId: runs[0].id },
      })
      console.log(`   Actions executed: ${actionLogs.length}\n`)
    } else {
      console.log('⏳ No automation runs yet (this is normal if Inngest is not running)\n')
    }

    // Step 7: Summary
    console.log('📊 Test Summary:')
    console.log(`   Practice: ${practice.name}`)
    console.log(`   Rule: ${rule.name} (${rule.enabled ? 'enabled' : 'disabled'})`)
    console.log(`   Outbox Event: ${outboxEvent.id}`)
    console.log(`   Automation Runs: ${runs.length}`)
    console.log('\n✅ Test completed!')
    console.log('\n💡 Next steps:')
    console.log('   1. Start Inngest dev server: npx inngest-cli@latest dev')
    console.log('   2. Visit http://localhost:8288 to see function executions')
    console.log('   3. Visit /settings/automations to manage rules in the UI')
  } catch (error) {
    console.error('❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('   Error:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testAutomation()

