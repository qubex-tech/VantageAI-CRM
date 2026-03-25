'use client'

import { useEffect } from 'react'

const RECAPTCHA_SCRIPT_ID = 'retell-recaptcha-v3'

interface RetellChatWidgetProps {
  publicKey?: string
  agentId: string
  agentVersion?: string
  title?: string
  color?: string
  botName?: string
  autoOpen?: boolean
  /** Google reCAPTCHA v3 site key if your Retell public key requires it */
  recaptchaSiteKey?: string
}

function ensureRecaptchaScript(siteKey: string): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(RECAPTCHA_SCRIPT_ID)) return
  const s = document.createElement('script')
  s.id = RECAPTCHA_SCRIPT_ID
  s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
  s.async = true
  document.head.appendChild(s)
}

/**
 * Retell AI Chat Widget — patient portal
 * @see https://docs.retellai.com/deploy/chat-widget
 */
export function RetellChatWidget({
  publicKey,
  agentId,
  agentVersion,
  title = 'Chat with us',
  color = '#0056b3',
  botName = 'Assistant',
  autoOpen = false,
  recaptchaSiteKey,
}: RetellChatWidgetProps) {
  useEffect(() => {
    if (!publicKey) {
      console.warn('[Retell] Public key missing; chat widget not loaded.')
      return
    }

    if (recaptchaSiteKey) {
      ensureRecaptchaScript(recaptchaSiteKey)
    }

    document.getElementById('retell-widget')?.remove()

    const script = document.createElement('script')
    script.id = 'retell-widget'
    script.src = 'https://dashboard.retellai.com/retell-widget.js'
    script.type = 'module'
    script.async = true
    script.setAttribute('data-public-key', publicKey)
    script.setAttribute('data-agent-id', agentId)
    if (agentVersion !== undefined) {
      script.setAttribute('data-agent-version', agentVersion)
    }
    if (recaptchaSiteKey) {
      script.setAttribute('data-recaptcha-key', recaptchaSiteKey)
    }
    script.setAttribute('data-title', title)
    script.setAttribute('data-color', color)
    script.setAttribute('data-bot-name', botName)
    script.setAttribute('data-auto-open', autoOpen ? 'true' : 'false')

    script.onerror = () => {
      console.error('[Retell] Failed to load https://dashboard.retellai.com/retell-widget.js')
    }

    document.body.appendChild(script)

    return () => {
      document.getElementById('retell-widget')?.remove()
    }
  }, [publicKey, agentId, agentVersion, title, color, botName, autoOpen, recaptchaSiteKey])

  return null
}
