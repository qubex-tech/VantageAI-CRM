import { describe, it, expect } from 'vitest'
import {
  buildAutomationRunPushMessage,
  shouldSkipAutomationPush,
} from '@/automations/automation-push-notification'

describe('automation push notification', () => {
  it('builds a practice push payload with automation type', () => {
    const message = buildAutomationRunPushMessage({
      practiceId: 'prac_1',
      ruleId: 'rule_1',
      ruleName: 'Birthday SMS',
      triggerEvent: 'crm/patient.birthday',
      runId: 'run_1',
      status: 'succeeded',
      patientId: 'pat_1',
      patientName: 'Jane Doe',
    })

    expect(message.title).toBe('Automation ran')
    expect(message.body).toBe('Birthday SMS · Jane · crm/patient.birthday')
    expect(message.data).toMatchObject({
      type: 'automation',
      ruleId: 'rule_1',
      patientId: 'pat_1',
      status: 'succeeded',
    })
  })

  it('uses failed title when status is failed', () => {
    const message = buildAutomationRunPushMessage({
      practiceId: 'prac_1',
      ruleId: 'rule_1',
      ruleName: 'Reminder',
      triggerEvent: 'crm/appointment.upcoming',
      runId: 'run_2',
      status: 'failed',
    })

    expect(message.title).toBe('Automation failed')
    expect(message.body).toBe('Reminder · crm/appointment.upcoming')
  })

  it('skips push when only substantive action is slot-fill outreach', () => {
    expect(
      shouldSkipAutomationPush([
        { actionType: 'wait_until_send_window', status: 'succeeded' },
        { actionType: 'send_slot_fill_outreach', status: 'succeeded' },
      ])
    ).toBe(true)
  })

  it('does not skip push for normal outreach actions', () => {
    expect(
      shouldSkipAutomationPush([{ actionType: 'send_sms', status: 'succeeded' }])
    ).toBe(false)
  })
})
