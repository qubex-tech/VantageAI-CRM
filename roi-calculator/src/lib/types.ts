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
