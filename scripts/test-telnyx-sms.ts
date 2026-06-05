/**
 * Send a test SMS using a practice's configured SMS provider (Telnyx preferred, Twilio fallback).
 *
 * Usage:
 *   tsx scripts/test-telnyx-sms.ts --practice-id <uuid> --to +15551234567
 *   tsx scripts/test-telnyx-sms.ts --practice-id <uuid> --to +15551234567 --message "Hello from Vantage"
 */

import { prisma } from '../src/lib/db'
import { getActiveSmsProvider, getSmsClient } from '../src/lib/sms'

interface CliArgs {
  practiceId: string
  to: string
  message: string
}

function parseArgs(argv: string[]): CliArgs {
  const args = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args.set(key, value)
    index += 1
  }

  const practiceId = args.get('practice-id')
  const to = args.get('to')
  if (!practiceId) {
    throw new Error('Missing required flag: --practice-id')
  }
  if (!to) {
    throw new Error('Missing required flag: --to')
  }

  return {
    practiceId,
    to,
    message: args.get('message') || 'Test SMS from Vantage',
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))

  const practice = await prisma.practice.findUnique({
    where: { id: cli.practiceId },
    select: { id: true, name: true },
  })

  if (!practice) {
    throw new Error(`Practice not found: ${cli.practiceId}`)
  }

  const provider = await getActiveSmsProvider(cli.practiceId)
  if (!provider) {
    throw new Error(
      'No active SMS provider for this practice. Configure Telnyx or Twilio in Settings first.'
    )
  }

  const telnyx = await prisma.telnyxIntegration.findUnique({
    where: { practiceId: cli.practiceId },
    select: { fromNumber: true, isActive: true },
  })

  const twilio = await prisma.twilioIntegration.findUnique({
    where: { practiceId: cli.practiceId },
    select: { fromNumber: true, messagingServiceSid: true, isActive: true },
  })

  console.log('Sending test SMS')
  console.log('─────────────────────────────────────')
  console.log(`Practice: ${practice.name} (${practice.id})`)
  console.log(`Provider: ${provider}`)
  if (provider === 'telnyx' && telnyx?.fromNumber) {
    console.log(`From: ${telnyx.fromNumber}`)
  } else if (provider === 'twilio') {
    console.log(`From: ${twilio?.fromNumber || twilio?.messagingServiceSid || '(messaging service)'}`)
  }
  console.log(`To: ${cli.to}`)
  console.log(`Message: ${cli.message}`)
  console.log('')

  const smsClient = await getSmsClient(cli.practiceId)
  const result = await smsClient.sendSms({
    to: cli.to,
    body: cli.message,
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to send SMS')
  }

  console.log('SMS sent successfully')
  console.log(`Provider message ID: ${result.messageId || '(none returned)'}`)
}

main()
  .catch((error) => {
    console.error('Test SMS failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
