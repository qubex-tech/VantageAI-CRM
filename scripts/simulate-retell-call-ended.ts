/**
 * Simulate RetellAI call_ended Webhook
 *
 * Tests Phase 1: Real-time call consumption without CRM login
 *
 * Usage:
 *   PRACTICE_ID=demo-practice-1 npm run simulate:retell:call-ended
 *   PRACTICE_ID=xxx CALL_ID=retell-call-id npm run simulate:retell:call-ended
 *
 * For full success, CALL_ID must be a real completed call ID from RetellAI.
 * With a fake CALL_ID, the webhook will succeed and Inngest will run, but
 * the Inngest function will fail when fetching the call from RetellAPI.
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/retell/webhook'
const PRACTICE_ID = process.env.PRACTICE_ID || 'demo-practice-1'
const CALL_ID = process.env.CALL_ID || `test-call-${Date.now()}`

const callEndedEvent = {
  event: 'call_ended',
  call: {
    call_id: CALL_ID,
    phone_number: '+15551234567',
    direction: 'inbound',
  },
}

async function simulateCallEnded() {
  console.log('Simulating RetellAI call_ended webhook...')
  console.log('  Webhook URL:', WEBHOOK_URL)
  console.log('  Practice ID:', PRACTICE_ID)
  console.log('  Call ID:', CALL_ID)
  console.log('')
  console.log('Payload:', JSON.stringify(callEndedEvent, null, 2))
  console.log('')

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Practice-Id': PRACTICE_ID,
        'X-Retell-Signature': 'test-signature', // Skip verification if RETELLAI_WEBHOOK_SECRET unset
      },
      body: JSON.stringify(callEndedEvent),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Webhook processed successfully')
      console.log('Response:', JSON.stringify(data, null, 2))
      console.log('')
      console.log('Next: Check Inngest dashboard (http://localhost:8288) for processRetellCallEnded execution.')
      console.log('The function will sleep 30s, then fetch the call from RetellAPI.')
      console.log('For full success, use a real CALL_ID from your RetellAI dashboard.')
    } else {
      console.error('❌ Webhook failed:', response.status)
      console.error(JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

simulateCallEnded()
