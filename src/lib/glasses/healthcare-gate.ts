import { GLASSES_DEMO_PATIENT_ID, type GlassesAskModel } from '@/lib/glasses/types'

/**
 * Meta Wearables terms require a signed Healthcare Addendum and BAA before PHI
 * is processed through the glasses SDK or Muse. The flag is set by ops after
 * that contract exists. A practice toggle cannot turn it on.
 */
export function isHealthcareAddendumSigned(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GLASSES_HEALTHCARE_ADDENDUM === 'true'
}

export function isGlassesDemoPatient(patientId: string): boolean {
  return patientId === GLASSES_DEMO_PATIENT_ID
}

export function glassesFeatureStatus(env: NodeJS.ProcessEnv = process.env) {
  const phiAllowed = isHealthcareAddendumSigned(env)
  return {
    phiAllowed,
    demoAvailable: true,
    reason: phiAllowed
      ? 'Healthcare addendum is on. A real chart can be sent to the glasses.'
      : 'Meta Healthcare Addendum is not signed. Glasses sessions use a fictional chart only.',
  }
}

export function healthcareAddendumRequiredBody() {
  return {
    error:
      'Meta has not signed a Healthcare Addendum and BAA. Real patient charts cannot be sent to the glasses or to Muse.',
    code: 'HEALTHCARE_ADDENDUM_REQUIRED' as const,
    demoAvailable: true,
  }
}

export function glassesAskModel(env: NodeJS.ProcessEnv = process.env): GlassesAskModel {
  if (env.GLASSES_ASK_MODEL === 'openai' || env.GLASSES_ASK_MODEL === 'muse') {
    return env.GLASSES_ASK_MODEL
  }
  return 'local'
}

/**
 * Muse stays off until the addendum is signed, including for the fictional chart.
 * The practice's existing model may answer the fictional chart before that.
 * A real chart never leaves the server for an external model without the addendum.
 */
export function externalAskAllowed(params: {
  model: GlassesAskModel
  demo: boolean
  addendumSigned: boolean
}): boolean {
  if (params.model === 'local') return true
  if (!params.addendumSigned && !params.demo) return false
  if (params.model === 'muse') return params.addendumSigned
  return params.demo || params.addendumSigned
}
