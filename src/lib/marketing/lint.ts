// Template linting utilities

import { TemplateChannel, BrandProfile, EmailDoc, LintResult, LintError, LintWarning } from './types'
import { validateVariables, extractVariables } from './variables'

/**
 * Lint a template based on channel type
 */
export function lintTemplate(
  channel: TemplateChannel,
  template: {
    subject?: string | null
    preheader?: string | null
    bodyJson?: any
    bodyHtml?: string | null
    bodyText?: string | null
    editorType?: string
  },
  brandProfile: BrandProfile | null
): LintResult {
  if (channel === 'email') {
    return lintEmailTemplate(template, brandProfile)
  } else {
    return lintSmsTemplate(template, brandProfile)
  }
}

function lintEmailTemplate(
  template: {
    subject?: string | null
    preheader?: string | null
    bodyJson?: any
    bodyHtml?: string | null
    bodyText?: string | null
    editorType?: string
  },
  brandProfile: BrandProfile | null
): LintResult {
  const errors: LintError[] = []
  const warnings: LintWarning[] = []
  
  // Subject required
  if (!template.subject || template.subject.trim().length === 0) {
    errors.push({
      field: 'subject',
      message: 'Email subject is required',
      severity: 'error',
    })
  }
  
  // Body must contain content
  const hasContent =
    (template.bodyJson && Object.keys(template.bodyJson).length > 0) ||
    (template.bodyHtml && template.bodyHtml.trim().length > 0) ||
    (template.bodyText && template.bodyText.trim().length > 0)
  
  if (!hasContent) {
    errors.push({
      field: 'body',
      message: 'Email body must contain at least one content block',
      severity: 'error',
    })
  }
  
  // Check for footer with practice info
  if (template.bodyHtml || template.bodyJson) {
    const bodyContent = template.bodyHtml || JSON.stringify(template.bodyJson)
    const practiceName = brandProfile?.practiceName || ''
    
    if (practiceName && !bodyContent.toLowerCase().includes(practiceName.toLowerCase())) {
      warnings.push({
        field: 'footer',
        message: 'Email should include practice name in footer for compliance',
        severity: 'warning',
      })
    }
    
    if (!brandProfile?.emailFooterHtml && !bodyContent.includes('practice') && !bodyContent.includes('address')) {
      warnings.push({
        field: 'footer',
        message: 'Email footer should include practice address for compliance',
        severity: 'warning',
      })
    }
  }
  
  // Validate variables
  const content = template.bodyHtml || template.bodyText || JSON.stringify(template.bodyJson || {})
  const varValidation = validateVariables(content)
  const subjectVars = template.subject ? validateVariables(template.subject) : { valid: true, unknown: [], known: [] }
  
  for (const unknownVar of varValidation.unknown) {
    errors.push({
      field: 'variables',
      message: `Unknown variable: {{${unknownVar}}}`,
      severity: 'error',
    })
  }
  
  for (const unknownVar of subjectVars.unknown) {
    errors.push({
      field: 'subject',
      message: `Unknown variable in subject: {{${unknownVar}}}`,
      severity: 'error',
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

function lintSmsTemplate(
  template: {
    bodyText?: string | null
    subject?: string | null
    preheader?: string | null
    bodyJson?: any
    bodyHtml?: string | null
  },
  brandProfile: BrandProfile | null
): LintResult {
  const errors: LintError[] = []
  const warnings: LintWarning[] = []
  
  // Body must not be empty
  if (!template.bodyText || template.bodyText.trim().length === 0) {
    errors.push({
      field: 'bodyText',
      message: 'SMS body must not be empty',
      severity: 'error',
    })
  } else {
    const text = template.bodyText.trim()
    
    // Check for practice name (or auto-injection)
    const practiceName = brandProfile?.practiceName || ''
    if (practiceName && !text.toLowerCase().includes(practiceName.toLowerCase())) {
      warnings.push({
        field: 'bodyText',
        message: 'SMS should include practice name (will be auto-prefixed if missing)',
        severity: 'warning',
      })
    }
    
    // Check for STOP footer
    const hasStopFooter =
      text.toLowerCase().includes('stop') ||
      text.toLowerCase().includes('reply stop') ||
      (brandProfile?.smsFooterText && text.includes(brandProfile.smsFooterText))
    
    if (!hasStopFooter && !brandProfile?.smsFooterText) {
      errors.push({
        field: 'bodyText',
        message: 'SMS must include STOP opt-out footer (or configure in brand settings)',
        severity: 'error',
      })
    } else if (!hasStopFooter && brandProfile?.smsFooterText) {
      // Footer will be auto-injected, so this is just a warning
      warnings.push({
        field: 'bodyText',
        message: 'SMS footer will be auto-injected from brand settings',
        severity: 'warning',
      })
    }
    
    // Validate variables
    const varValidation = validateVariables(text)
    for (const unknownVar of varValidation.unknown) {
      errors.push({
        field: 'variables',
        message: `Unknown variable: {{${unknownVar}}}`,
        severity: 'error',
      })
    }
    
    // Check length (warn if very long)
    if (text.length > 500) {
      warnings.push({
        field: 'bodyText',
        message: `SMS is ${text.length} characters, which may result in multiple segments`,
        severity: 'warning',
      })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if current time is within quiet hours
 */
export function quietHoursCheck(
  time: Date,
  timezone: string,
  quietHoursStart: string, // HH:mm format
  quietHoursEnd: string // HH:mm format
): boolean {
  try {
    // Get current time in specified timezone
    const now = new Date(time)
    const tzTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    
    const currentHour = parseInt(tzTime.find(p => p.type === 'hour')?.value || '0', 10)
    const currentMinute = parseInt(tzTime.find(p => p.type === 'minute')?.value || '0', 10)
    const currentMinutes = currentHour * 60 + currentMinute
    
    // Parse quiet hours
    const [startHour, startMin] = quietHoursStart.split(':').map(Number)
    const [endHour, endMin] = quietHoursEnd.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    // Handle quiet hours that span midnight
    if (startMinutes > endMinutes) {
      // Quiet hours span midnight (e.g., 22:00 - 09:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    } else {
      // Normal case (e.g., 09:00 - 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error)
    return false // On error, allow sending
  }
}

/**
 * Check if patient can be contacted via channel
 */
export function canContactPatient(
  channel: TemplateChannel,
  patient: {
    doNotContact?: boolean
    smsOptIn?: boolean
    emailOptIn?: boolean
  }
): { allowed: boolean; reason?: string } {
  if (patient.doNotContact) {
    return { allowed: false, reason: 'Patient has opted out of all communications' }
  }
  
  if (channel === 'sms' && !patient.smsOptIn) {
    return { allowed: false, reason: 'Patient has not opted in to SMS communications' }
  }
  
  if (channel === 'email' && !patient.emailOptIn) {
    return { allowed: false, reason: 'Patient has not opted in to email communications' }
  }
  
  return { allowed: true }
}
