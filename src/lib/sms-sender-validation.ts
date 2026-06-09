/**
 * Guidance shown when a practice tries to use a phone number that is not on their SMS provider account.
 * Carriers block arbitrary caller-ID spoofing; the number must be purchased, ported, or hosted.
 */

export const SMS_HOSTED_NUMBER_HELP = {
  summary:
    'SMS providers cannot send from a number you do not own on their network. You must host or port the number first (voice can stay with your current carrier).',
  telnyxHostedSmsUrl: 'https://portal.telnyx.com/#/app/messaging/hosted-sms',
  telnyxHostedSmsDocs: 'https://developers.telnyx.com/docs/messaging/messages/hosted-sms',
  twilioHostedSmsUrl: 'https://console.twilio.com/us1/develop/phone-numbers/port-host/host',
  twilioHostedSmsDocs: 'https://www.twilio.com/docs/phone-numbers/hosted-numbers',
} as const

export function buildTwilioSenderNotOnAccountError(fromNumber: string): string {
  return (
    `${fromNumber} is not on your Twilio account. Twilio cannot send from numbers you do not own. ` +
    `Host your practice line on Twilio (Hosted SMS — voice stays with your current carrier) or port/buy the number in Twilio, ` +
    `then save it here. See: ${SMS_HOSTED_NUMBER_HELP.twilioHostedSmsDocs}`
  )
}

export function buildTelnyxSenderNotOnAccountError(fromNumber: string): string {
  return (
    `${fromNumber} is not on your Telnyx account. Host the number in Telnyx Hosted SMS (voice can stay with your current carrier), ` +
    `assign it to a messaging profile, then select it under "Telnyx account number". ` +
    `See: ${SMS_HOSTED_NUMBER_HELP.telnyxHostedSmsDocs}`
  )
}
