export type IntentLabel =
  | 'appointment_scheduling'
  | 'billing_payment'
  | 'insurance_coverage'
  | 'practice_provider'
  | 'medication_refill'
  | 'test_results'
  | 'symptoms'
  | 'general_admin'
  | 'unknown'

export interface IntentResult {
  label: IntentLabel
  confidence: 'low' | 'medium' | 'high'
}

// LLM abstraction placeholder - replace with provider implementation.
export async function classifyIntent(message: string): Promise<IntentResult> {
  void message
  return { label: 'unknown', confidence: 'low' }
}
