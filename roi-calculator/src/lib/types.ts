import type { RoiInputs } from './roi'

export interface ProspectResearch {
  company: {
    name: string
    legalName?: string
    industry?: string
    sector?: string
    headquarters?: string
    country?: string
    website?: string
    description?: string
  }
  workforce: {
    totalEmployees?: number
    frontlineWorkers?: number
    storeCount?: number
    annualTurnoverPct?: number
    notes?: string
  }
  compliance: {
    primaryRegulation?: string // e.g. "Natasha's Law (UK, 2021)"
    rationale?: string
    risk?: 'low' | 'medium' | 'high'
  }
  strategicPriorities?: string[]
  recentNews?: Array<{ title: string; summary: string; date?: string }>
  // Suggested defaults the LLM picked for the ROI inputs given the country/industry
  suggestedInputs: Partial<RoiInputs>
  // Magazine-style narrative blocks
  narrative: {
    headline: string // big "Before a Single X is Sold." style
    subhead: string
    hiddenTimeCost: string
    managerBurden: string
    closingLine: string
    complianceKicker: string
    strategicOutcomes: Array<{ title: string; body: string }>
  }
  sources?: Array<{ title: string; uri: string }>
}

export interface ResearchRequest {
  prospectName: string
}

export interface ResearchResponse {
  ok: true
  research: ProspectResearch
}

export interface ResearchError {
  ok: false
  error: string
}

// ---- Play makers (meeting prep) --------------------------------------------

export interface PlayMaker {
  id: string
  // Input
  inputName: string
  // Identified person
  fullName?: string
  title?: string
  company?: string
  tenure?: string
  location?: string
  linkedinUrl?: string
  // Background
  bio?: string
  background?: string
  previousRoles?: Array<{ role: string; org: string; period?: string }>
  education?: string[]
  // Sales-relevant
  responsibilities?: string[]
  priorities?: string[]
  publicQuotes?: Array<{ quote: string; context?: string; date?: string; url?: string }>
  recentActivity?: Array<{ title: string; summary: string; date?: string; url?: string }>
  // Meeting prep
  talkingPoints?: string[]
  conversationStarters?: string[]
  potentialObjections?: string[]
  commonGround?: string[]
  // Identity confidence + raw notes
  confidence: 'low' | 'medium' | 'high'
  identityNotes?: string
  // Sources
  sources?: Array<{ title: string; uri: string }>
}

export interface PlayMakersRequest {
  names: string[]
  company?: string
}

export interface PlayMakersResponse {
  ok: true
  playMakers: PlayMaker[]
}

