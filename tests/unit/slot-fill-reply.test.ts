import { describe, expect, it } from 'vitest'
import {
  anonymizeReplyText,
  classifySlotFillReply,
} from '@/lib/appointment-optimization/classifySlotFillReply'

describe('classifySlotFillReply', () => {
  it('accepts YES via keyword without LLM', async () => {
    const result = await classifySlotFillReply('YES', {
      offeredSlotDescription: 'Tuesday, Jul 7 at 9:30 AM',
    })
    expect(result.intent).toBe('accept_earlier_slot')
    expect(result.method).toBe('keyword')
  })

  it('declines via keyword', async () => {
    const result = await classifySlotFillReply('no thanks', {
      offeredSlotDescription: 'Tuesday, Jul 7 at 9:30 AM',
    })
    expect(result.intent).toBe('decline')
  })

  it('anonymizes phone numbers in reply text', () => {
    expect(anonymizeReplyText('call me at 708-555-1234')).toBe('call me at [phone]')
  })
})
