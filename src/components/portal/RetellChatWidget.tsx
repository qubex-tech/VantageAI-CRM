'use client'

import { useEffect } from 'react'

interface RetellChatWidgetProps {
  publicKey?: string
  agentId: string
  agentVersion?: string
  title?: string
  color?: string
  botName?: string
  autoOpen?: boolean
}

/**
 * Retell AI Chat Widget Component
 * Embeds the Retell chat widget on patient portal pages
 * Documentation: https://docs.retellai.com/deploy/chat-widget
 */
export function RetellChatWidget({
  publicKey,
  agentId,
  agentVersion,
  title = 'Chat with us',
  color = '#0056b3',
  botName = 'Assistant',
  autoOpen = false,
}: RetellChatWidgetProps) {
  useEffect(() => {
    // Only load widget if public key is provided
    if (!publicKey) {
      console.warn('Retell public key not provided. Chat widget will not be loaded.')
      return
    }

    // Check if script is already loaded
    if (document.getElementById('retell-widget')) {
      return
    }

    // Create and append the script tag
    const script = document.createElement('script')
    script.id = 'retell-widget'
    script.src = 'https://dashboard.retellai.com/retell-widget.js'
    script.type = 'module'
    script.setAttribute('data-public-key', publicKey)
    script.setAttribute('data-agent-id', agentId)
    
    if (agentVersion !== undefined) {
      script.setAttribute('data-agent-version', agentVersion)
    }
    
    script.setAttribute('data-title', title)
    script.setAttribute('data-color', color)
    script.setAttribute('data-bot-name', botName)
    script.setAttribute('data-auto-open', autoOpen ? 'true' : 'false')

    document.head.appendChild(script)

    // Cleanup function
    return () => {
      const existingScript = document.getElementById('retell-widget')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [publicKey, agentId, agentVersion, title, color, botName, autoOpen])

  // This component doesn't render anything visible
  // The widget script creates the floating button
  return null
}
