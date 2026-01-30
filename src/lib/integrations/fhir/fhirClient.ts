import { refreshAccessToken, TokenResponse } from '@/lib/integrations/smart/smartClient'
import { supportsResourceInteraction, ResourceInteraction } from './capabilities'

export class WriteNotSupportedError extends Error {
  code = 'WRITE_NOT_SUPPORTED'
  supportedInteractions: ResourceInteraction[]
  constructor(message: string, supportedInteractions: ResourceInteraction[]) {
    super(message)
    this.supportedInteractions = supportedInteractions
  }
}

type TokenState = {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresAt?: Date | null
  scopes?: string
}

type FhirClientOptions = {
  baseUrl: string
  tokenEndpoint?: string
  clientId?: string
  tokenState: TokenState
  onTokenRefresh?: (tokenResponse: TokenResponse) => Promise<void> | void
  timeoutMs?: number
}

type PatientInput = {
  name: {
    given: string[]
    family?: string
    text?: string
  }
  telecom?: Array<{ system: 'phone' | 'email'; value: string; use?: string }>
  gender?: string
  birthDate?: string
  address?: {
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  identifiers?: Array<{ system?: string; value: string }>
}

export class FhirClient {
  private baseUrl: string
  private tokenEndpoint?: string
  private clientId?: string
  private tokenState: TokenState
  private onTokenRefresh?: (tokenResponse: TokenResponse) => Promise<void> | void
  private timeoutMs: number

  constructor(options: FhirClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/g, '')
    this.tokenEndpoint = options.tokenEndpoint
    this.clientId = options.clientId
    this.tokenState = options.tokenState
    this.onTokenRefresh = options.onTokenRefresh
    this.timeoutMs = options.timeoutMs ?? 10000
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }

  private isExpired() {
    if (!this.tokenState.expiresAt) {
      return false
    }
    return this.tokenState.expiresAt.getTime() <= Date.now() + 30_000
  }

  private async refreshIfNeeded() {
    if (!this.isExpired()) {
      return
    }
    if (!this.tokenEndpoint || !this.clientId || !this.tokenState.refreshToken) {
      return
    }

    const tokenResponse = await refreshAccessToken({
      tokenEndpoint: this.tokenEndpoint,
      clientId: this.clientId,
      refreshToken: this.tokenState.refreshToken,
      scopes: this.tokenState.scopes,
    })
    this.applyTokenResponse(tokenResponse)
    await this.onTokenRefresh?.(tokenResponse)
  }

  private async refreshNow() {
    if (!this.tokenEndpoint || !this.clientId || !this.tokenState.refreshToken) {
      return
    }
    const tokenResponse = await refreshAccessToken({
      tokenEndpoint: this.tokenEndpoint,
      clientId: this.clientId,
      refreshToken: this.tokenState.refreshToken,
      scopes: this.tokenState.scopes,
    })
    this.applyTokenResponse(tokenResponse)
    await this.onTokenRefresh?.(tokenResponse)
  }

  private applyTokenResponse(tokenResponse: TokenResponse) {
    if (tokenResponse.access_token) {
      this.tokenState.accessToken = tokenResponse.access_token
    }
    if (tokenResponse.refresh_token) {
      this.tokenState.refreshToken = tokenResponse.refresh_token
    }
    if (tokenResponse.token_type) {
      this.tokenState.tokenType = tokenResponse.token_type
    }
    if (tokenResponse.expires_in) {
      this.tokenState.expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000)
    }
    if (tokenResponse.scope) {
      this.tokenState.scopes = tokenResponse.scope
    }
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    await this.refreshIfNeeded()
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const headers = new Headers(init?.headers)
    headers.set('accept', 'application/fhir+json')
    if (!headers.has('content-type') && init?.body) {
      headers.set('content-type', 'application/fhir+json')
    }

    const response = await this.fetchWithTimeout(url, {
      ...init,
      headers: {
        ...Object.fromEntries(headers.entries()),
        authorization: `Bearer ${this.tokenState.accessToken}`,
      },
    })

    if (response.status === 401 && this.tokenState.refreshToken) {
      await this.refreshNow()
      const retryResponse = await this.fetchWithTimeout(url, {
        ...init,
        headers: {
          ...Object.fromEntries(headers.entries()),
          authorization: `Bearer ${this.tokenState.accessToken}`,
        },
      })
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text()
        throw new Error(`FHIR request failed: ${retryResponse.status} ${errorText}`)
      }
      return (await retryResponse.json()) as T
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FHIR request failed: ${response.status} ${errorText}`)
    }
    return (await response.json()) as T
  }

  async getCapabilityStatement() {
    return this.request('/metadata')
  }

  async getPatient(patientId: string) {
    return this.request(`/Patient/${patientId}`)
  }

  async searchPatients(query: Record<string, string>) {
    const params = new URLSearchParams(query)
    return this.request(`/Patient?${params.toString()}`)
  }

  async createPatient(input: PatientInput, capabilityStatement: any) {
    if (!supportsResourceInteraction(capabilityStatement, 'Patient', 'create')) {
      const supported = supportsForResource(capabilityStatement, 'Patient')
      throw new WriteNotSupportedError('Patient create not supported', supported)
    }
    const resource: any = {
      resourceType: 'Patient',
      name: [
        {
          given: input.name.given,
          family: input.name.family,
          text: input.name.text,
        },
      ],
      gender: input.gender,
      birthDate: input.birthDate,
      address: input.address ? [input.address] : undefined,
      telecom: input.telecom,
      identifier: input.identifiers,
    }

    return this.request('/Patient', {
      method: 'POST',
      body: JSON.stringify(resource),
    })
  }

  async createBinary(contentType: string, base64Data: string, capabilityStatement: any) {
    if (!supportsResourceInteraction(capabilityStatement, 'Binary', 'create')) {
      const supported = supportsForResource(capabilityStatement, 'Binary')
      throw new WriteNotSupportedError('Binary create not supported', supported)
    }
    const payload = {
      resourceType: 'Binary',
      contentType,
      data: base64Data,
    }
    return this.request('/Binary', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async createDocumentReferenceNote(params: {
    patientId: string
    noteText: string
    authorReference?: string
    preferPreliminary?: boolean
    requireBinary?: boolean
    capabilityStatement: any
  }) {
    if (!supportsResourceInteraction(params.capabilityStatement, 'DocumentReference', 'create')) {
      const supported = supportsForResource(params.capabilityStatement, 'DocumentReference')
      throw new WriteNotSupportedError('DocumentReference create not supported', supported)
    }

    const noteData = Buffer.from(params.noteText, 'utf8').toString('base64')
    let attachment: any = {
      contentType: 'text/plain',
      data: noteData,
    }

    if (params.requireBinary) {
      const binary = (await this.createBinary('text/plain', noteData, params.capabilityStatement)) as any
      if (binary?.id) {
        attachment = {
          contentType: 'text/plain',
          url: `Binary/${binary.id}`,
          title: 'AI Generated Draft Note',
        }
      }
    }

    const status = params.preferPreliminary ? 'preliminary' : 'current'
    const resource: any = {
      resourceType: 'DocumentReference',
      status,
      type: { text: 'Clinical note' },
      category: [{ text: 'Telephone encounter' }],
      subject: { reference: `Patient/${params.patientId}` },
      date: new Date().toISOString(),
      description:
        'AI-generated draft note created by Vantage AI; requires clinician review and signature.',
      content: [{ attachment }],
    }

    if (!params.preferPreliminary) {
      resource.title = 'DRAFT - AI Generated Note'
    }

    if (params.authorReference) {
      resource.author = [{ reference: params.authorReference }]
    }

    const created = (await this.request('/DocumentReference', {
      method: 'POST',
      body: JSON.stringify(resource),
    })) as any

    const id = created?.id
    const reviewUrl = id ? `${this.baseUrl}/DocumentReference/${id}` : undefined
    return { id, reviewUrl, resource: created }
  }
}

function supportsForResource(capabilityStatement: any, resourceType: string) {
  const interactions = capabilityStatement?.rest?.[0]?.resource || []
  const resource = interactions.find((entry: any) => entry.type === resourceType)
  return (resource?.interaction || [])
    .map((entry: any) => entry.code)
    .filter(Boolean)
}
