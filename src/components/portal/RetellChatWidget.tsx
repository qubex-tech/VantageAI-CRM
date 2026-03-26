'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    grecaptcha?: { ready: (cb: () => void) => void }
  }
}

const RECAPTCHA_SCRIPT_ID = 'retell-recaptcha-v3'

interface RetellChatWidgetProps {
  publicKey?: string
  agentId: string
  /** Retell example uses "0"; omit for platform default/latest */
  agentVersion?: string
  title?: string
  color?: string
  botName?: string
  autoOpen?: boolean
  /** Google reCAPTCHA v3 site key when Retell public key has bot protection */
  recaptchaSiteKey?: string
  /** JSON string for data-dynamic (agent variables) */
  dynamicJson?: string
}

function appendRetellScript(params: {
  publicKey: string
  agentId: string
  agentVersion?: string
  title: string
  color: string
  botName: string
  autoOpen: boolean
  recaptchaSiteKey?: string
  dynamicJson?: string
}) {
  document.getElementById('retell-widget')?.remove()

  const script = document.createElement('script')
  script.id = 'retell-widget'
  script.src = 'https://dashboard.retellai.com/retell-widget.js'
  script.type = 'module'
  script.async = true
  script.setAttribute('data-public-key', params.publicKey)
  script.setAttribute('data-agent-id', params.agentId)
  if (params.agentVersion !== undefined && params.agentVersion !== '') {
    script.setAttribute('data-agent-version', params.agentVersion)
  }
  if (params.recaptchaSiteKey) {
    script.setAttribute('data-recaptcha-key', params.recaptchaSiteKey)
  }
  script.setAttribute('data-title', params.title)
  script.setAttribute('data-color', params.color)
  script.setAttribute('data-bot-name', params.botName)
  script.setAttribute('data-auto-open', params.autoOpen ? 'true' : 'false')
  if (params.dynamicJson) {
    script.setAttribute('data-dynamic', params.dynamicJson)
  }

  script.onerror = () => {
    console.error('[Retell] Failed to load https://dashboard.retellai.com/retell-widget.js')
  }

  document.head.appendChild(script)
}

/**
 * Retell chat widget — matches https://docs.retellai.com/deploy/chat-widget (head, reCAPTCHA order).
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
  dynamicJson,
}: RetellChatWidgetProps) {
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!publicKey) {
      console.warn('[Retell] Public key missing; chat widget not loaded.')
      return
    }

    const runInject = () => {
      if (cancelledRef.current) return
      appendRetellScript({
        publicKey,
        agentId,
        agentVersion,
        title,
        color,
        botName,
        autoOpen,
        recaptchaSiteKey,
        dynamicJson,
      })
    }

    const afterRecaptchaReady = () => {
      const g = window.grecaptcha
      if (g?.ready) {
        g.ready(() => {
          if (!cancelledRef.current) runInject()
        })
      } else {
        console.warn(
          '[Retell] grecaptcha.ready missing after script load. If chat stays blank, confirm reCAPTCHA v3 site key matches Retell dashboard.'
        )
        runInject()
      }
    }

    if (recaptchaSiteKey) {
      const existing = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null
      if (existing?.dataset.loaded === 'true') {
        afterRecaptchaReady()
      } else if (existing) {
        existing.addEventListener(
          'load',
          () => {
            existing.dataset.loaded = 'true'
            afterRecaptchaReady()
          },
          { once: true }
        )
      } else {
        const s = document.createElement('script')
        s.id = RECAPTCHA_SCRIPT_ID
        s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`
        s.async = true
        s.onload = () => {
          s.dataset.loaded = 'true'
          afterRecaptchaReady()
        }
        s.onerror = () => {
          console.error('[Retell] Failed to load Google reCAPTCHA script; portal chat may stay blank.')
          runInject()
        }
        document.head.appendChild(s)
      }
    } else {
      runInject()
    }

    return () => {
      cancelledRef.current = true
      document.getElementById('retell-widget')?.remove()
    }
  }, [publicKey, agentId, agentVersion, title, color, botName, autoOpen, recaptchaSiteKey, dynamicJson])

  return null
}
