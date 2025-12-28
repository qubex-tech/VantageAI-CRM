/**
 * Test script for Cal.com integration
 * 
 * Usage: tsx scripts/test-cal-integration.ts
 */

import { CalApiClient } from '../src/lib/cal'

const API_KEY = 'cal_live_3bb83c6e7571c1f53904014c3f097327'

async function testCalIntegration() {
  console.log('🔍 Testing Cal.com Integration...\n')
  
  const client = new CalApiClient(API_KEY)

  try {
    // Test 1: Get Event Types
    console.log('1️⃣ Testing: Get Event Types')
    console.log('─────────────────────────────────────')
    try {
      const eventTypes = await client.getEventTypes()
      console.log('✅ Success! Found', eventTypes.length, 'event types')
      if (eventTypes.length > 0) {
        console.log('\nEvent Types:')
        eventTypes.slice(0, 5).forEach((et, idx) => {
          console.log(`  ${idx + 1}. ${et.title} (ID: ${et.id}, Length: ${et.length} min)`)
        })
        if (eventTypes.length > 5) {
          console.log(`  ... and ${eventTypes.length - 5} more`)
        }
      }
    } catch (error: any) {
      console.error('❌ Failed:', error.message)
      if (error.message.includes('401') || error.message.includes('403')) {
        console.error('   → Check if your API key is valid and has proper permissions')
      }
    }

    console.log('\n')

    // Test 2: Test Connection
    console.log('2️⃣ Testing: Connection Test')
    console.log('─────────────────────────────────────')
    try {
      const isValid = await client.testConnection()
      if (isValid) {
        console.log('✅ Connection test successful!')
      } else {
        console.log('❌ Connection test failed')
      }
    } catch (error: any) {
      console.error('❌ Connection test error:', error.message)
    }

    console.log('\n')
    console.log('📝 Next Steps:')
    console.log('─────────────────────────────────────')
    console.log('1. Go to Settings page in the app')
    console.log('2. Enter the API key:', API_KEY)
    console.log('3. Click "Test Connection"')
    console.log('4. If successful, click "Save Settings"')
    console.log('5. Map your event types to visit types')
    console.log('\n💡 To get event type IDs for mapping, check the output above')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

testCalIntegration()

