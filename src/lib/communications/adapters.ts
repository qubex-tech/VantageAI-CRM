import type { AdapterSendInput, AdapterSendResult, ChannelAdapter, CommunicationChannel } from './types'

const randomId = () => `stub_${Math.random().toString(36).slice(2)}`

const simulateDelivery = async (): Promise<AdapterSendResult> => {
  await new Promise((resolve) => setTimeout(resolve, 120))
  return {
    status: 'sent',
    providerMessageId: randomId(),
  }
}

const hasPhone = (recipient: AdapterSendInput['recipient']) => Boolean(recipient.phone)
const hasEmail = (recipient: AdapterSendInput['recipient']) => Boolean(recipient.email)

export class SmsAdapter implements ChannelAdapter {
  channel: CommunicationChannel = 'sms'
  supportsAttachments = false

  validateRecipient(recipient: AdapterSendInput['recipient']) {
    return hasPhone(recipient)
  }

  async sendMessage(_input: AdapterSendInput) {
    return simulateDelivery()
  }
}

export class SecureMessageAdapter implements ChannelAdapter {
  channel: CommunicationChannel = 'secure'
  supportsAttachments = true

  validateRecipient(recipient: AdapterSendInput['recipient']) {
    return hasEmail(recipient) || hasPhone(recipient)
  }

  async sendMessage(_input: AdapterSendInput) {
    return simulateDelivery()
  }
}

export class VoiceAdapter implements ChannelAdapter {
  channel: CommunicationChannel = 'voice'
  supportsAttachments = false

  validateRecipient(recipient: AdapterSendInput['recipient']) {
    return hasPhone(recipient)
  }

  async sendMessage(_input: AdapterSendInput) {
    return simulateDelivery()
  }
}

export class VideoAdapter implements ChannelAdapter {
  channel: CommunicationChannel = 'video'
  supportsAttachments = false

  validateRecipient(recipient: AdapterSendInput['recipient']) {
    return hasEmail(recipient) || hasPhone(recipient)
  }

  async sendMessage(_input: AdapterSendInput) {
    return simulateDelivery()
  }
}

const adapters: Record<CommunicationChannel, ChannelAdapter> = {
  sms: new SmsAdapter(),
  secure: new SecureMessageAdapter(),
  voice: new VoiceAdapter(),
  video: new VideoAdapter(),
}

export function getChannelAdapter(channel: CommunicationChannel) {
  return adapters[channel]
}
