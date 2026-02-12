'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RetellSettingsProps {
  initialIntegration: any
  practiceId?: string // Optional practiceId for Vantage Admins
}

export function RetellSettings({ initialIntegration, practiceId }: RetellSettingsProps) {
  // Helper function to append practiceId to URLs if provided
  const apiUrl = (path: string) => {
    if (practiceId) {
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}practiceId=${practiceId}`
    }
    return path
  }
  const [apiKey, setApiKey] = useState('')
  const [agentId, setAgentId] = useState(initialIntegration?.agentId || '')
  const [mcpBaseUrl, setMcpBaseUrl] = useState(initialIntegration?.mcpBaseUrl || '')
  const [mcpApiKey, setMcpApiKey] = useState(initialIntegration?.mcpApiKey || '')
  const [mcpActorId, setMcpActorId] = useState(initialIntegration?.mcpActorId || '')
  const [mcpRequestIdPrefix, setMcpRequestIdPrefix] = useState(initialIntegration?.mcpRequestIdPrefix || '')
  const [outboundToolName, setOutboundToolName] = useState(initialIntegration?.outboundToolName || 'create_outbound_call')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testing, setTesting] = useState(false)

  const hasSavedApiKey = Boolean(initialIntegration?.hasApiKey || initialIntegration?.apiKey)

  useEffect(() => {
    setApiKey('')
    setAgentId(initialIntegration?.agentId || '')
    setMcpBaseUrl(initialIntegration?.mcpBaseUrl || '')
    setMcpApiKey(initialIntegration?.mcpApiKey || '')
    setMcpActorId(initialIntegration?.mcpActorId || '')
    setMcpRequestIdPrefix(initialIntegration?.mcpRequestIdPrefix || '')
    setOutboundToolName(initialIntegration?.outboundToolName || 'create_outbound_call')
  }, [initialIntegration])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/settings/retell'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          agentId: agentId || undefined,
          mcpBaseUrl: mcpBaseUrl || undefined,
          mcpApiKey: mcpApiKey || undefined,
          mcpActorId: mcpActorId || undefined,
          mcpRequestIdPrefix: mcpRequestIdPrefix || undefined,
          outboundToolName: outboundToolName || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSuccess('RetellAI integration saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setSuccess('')
    setTesting(true)

    try {
      const response = await fetch(apiUrl('/api/settings/retell/test'))
      const data = await response.json()

      if (data.success) {
        setSuccess('Connection test successful!')
      } else {
        setError(data.message || 'Connection test failed')
      }
    } catch (err) {
      setError('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">RetellAI Integration</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Configure your RetellAI API key to view and manage voice agent calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
              API Key {!hasSavedApiKey ? '*' : '(optional to change)'}
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasSavedApiKey ? 'Leave blank to keep existing key' : 'Enter your RetellAI API key'}
              className="font-mono text-sm"
              required={!hasSavedApiKey}
            />
            <p className="text-xs text-gray-500">
              {hasSavedApiKey
                ? 'A Retell API key is already configured for this practice. Enter a new key only if you want to rotate it.'
                : 'Get your API key from '}
              {!hasSavedApiKey && (
              <>
              {' '}
              <a
                href="https://retellai.com/dashboard/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                RetellAI Dashboard → Settings → API Keys
              </a>
              </>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentId" className="text-sm font-medium text-gray-700">
              Agent ID (Optional)
            </Label>
            <Input
              id="agentId"
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="Default agent ID for this practice"
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Optionally specify a default agent ID to filter calls by agent
            </p>
          </div>

          <div className="space-y-2 border-t border-gray-200 pt-4">
            <Label htmlFor="mcpBaseUrl" className="text-sm font-medium text-gray-700">
              MCP Base URL (Optional)
            </Label>
            <Input
              id="mcpBaseUrl"
              type="url"
              value={mcpBaseUrl}
              onChange={(e) => setMcpBaseUrl(e.target.value)}
              placeholder="https://app.getvantage.tech/mcp"
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Used for outbound call tool invocation via MCP JSON-RPC.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mcpApiKey" className="text-sm font-medium text-gray-700">
                MCP API Key (Optional)
              </Label>
              <Input
                id="mcpApiKey"
                type="password"
                value={mcpApiKey}
                onChange={(e) => setMcpApiKey(e.target.value)}
                placeholder="x-api-key value"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcpActorId" className="text-sm font-medium text-gray-700">
                MCP Actor ID (Optional)
              </Label>
              <Input
                id="mcpActorId"
                type="text"
                value={mcpActorId}
                onChange={(e) => setMcpActorId(e.target.value)}
                placeholder="retell-healix"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcpRequestIdPrefix" className="text-sm font-medium text-gray-700">
                Request ID Prefix (Optional)
              </Label>
              <Input
                id="mcpRequestIdPrefix"
                type="text"
                value={mcpRequestIdPrefix}
                onChange={(e) => setMcpRequestIdPrefix(e.target.value)}
                placeholder="healix-outbound"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outboundToolName" className="text-sm font-medium text-gray-700">
                Outbound Tool Name (Optional)
              </Label>
              <Input
                id="outboundToolName"
                type="text"
                value={outboundToolName}
                onChange={(e) => setOutboundToolName(e.target.value)}
                placeholder="create_outbound_call"
                className="text-sm"
              />
            </div>
          </div>

          {(error || success) && (
            <div
              className={`p-3 rounded-md text-sm ${
                error
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-green-50 text-green-600 border border-green-200'
              }`}
            >
              {error || success}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || testing}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={loading || testing || (!apiKey && !hasSavedApiKey)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

