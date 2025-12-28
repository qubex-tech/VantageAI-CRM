/**
 * Simulate RetellAI Webhook
 * 
 * This script simulates a RetellAI webhook call for testing purposes
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/retell/webhook'
const PRACTICE_ID = process.env.PRACTICE_ID || 'demo-practice-1'

const sampleWebhookEvent = {
  event: 'tool_calls',
  call: {
    call_id: `test-call-${Date.now()}`,
    phone_number: '+15551001',
    direction: 'inbound',
  },
  transcript: {
    content: 'Patient called to schedule an appointment. They prefer morning times.',
  },
  tool_calls: [
    {
      tool_name: 'find_or_create_patient',
      parameters: {
        phone: '+15551001',
        name: 'John Doe',
      },
    },
  ],
}

async function simulateWebhook() {
  console.log('Simulating RetellAI webhook...')
  console.log('Webhook URL:', WEBHOOK_URL)
  console.log('Practice ID:', PRACTICE_ID)
  console.log('Event:', JSON.stringify(sampleWebhookEvent, null, 2))

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Practice-Id': PRACTICE_ID,
        'X-Retell-Signature': 'test-signature', // In production, this would be a real signature
      },
      body: JSON.stringify(sampleWebhookEvent),
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Webhook processed successfully:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.error('❌ Webhook failed:')
      console.error(JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error('Error sending webhook:', error)
  }
}

simulateWebhook()

