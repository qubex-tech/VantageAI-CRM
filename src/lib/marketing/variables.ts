// Variable extraction and substitution utilities

import { VariableContext } from './types'

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

/**
 * Extract all variable keys from text/HTML/JSON content
 */
export function extractVariables(content: string | object): string[] {
  if (typeof content === 'object') {
    // Recursively extract from JSON structure
    const contentStr = JSON.stringify(content)
    return extractVariablesFromString(contentStr)
  }
  return extractVariablesFromString(content)
}

function extractVariablesFromString(text: string): string[] {
  const variables: string[] = []
  const matches = text.matchAll(VARIABLE_PATTERN)
  
  for (const match of matches) {
    const varKey = match[1].trim()
    if (varKey && !variables.includes(varKey)) {
      variables.push(varKey)
    }
  }
  
  return variables
}

/**
 * Resolve a variable key to its value from context
 * Supports nested paths like "patient.firstName"
 */
export function resolveVariable(varKey: string, context: VariableContext): string {
  const parts = varKey.split('.')
  let value: any = context
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part as keyof typeof value]
    } else {
      // Variable not found, return fallback
      return getVariableFallback(varKey)
    }
  }
  
  if (value === null || value === undefined) {
    return getVariableFallback(varKey)
  }
  
  return String(value)
}

/**
 * Get fallback value for unknown variables
 */
function getVariableFallback(varKey: string): string {
  // Map common variables to friendly fallbacks
  const fallbacks: Record<string, string> = {
    'patient.firstName': 'there',
    'patient.lastName': '',
    'patient.preferredName': 'there',
    'practice.name': 'our practice',
    'practice.phone': '',
    'practice.address': '',
    'appointment.date': 'your appointment',
    'appointment.time': '',
    'appointment.location': '',
    'appointment.providerName': 'your provider',
    'links.confirm': '#',
    'links.reschedule': '#',
    'links.cancel': '#',
    'links.portalVerified': '#',
    'links.formRequest': '#',
  }
  
  // Check if we have a specific fallback
  if (varKey in fallbacks) {
    return fallbacks[varKey]
  }
  
  // Check if it's a nested path we partially recognize
  if (varKey.startsWith('patient.')) {
    return ''
  }
  if (varKey.startsWith('practice.')) {
    return ''
  }
  if (varKey.startsWith('appointment.')) {
    return ''
  }
  if (varKey.startsWith('links.')) {
    return '#'
  }
  
  // Unknown variable, return empty string
  return ''
}

/**
 * Replace all variables in a string with values from context
 */
export function replaceVariables(
  template: string,
  context: VariableContext
): string {
  return template.replace(VARIABLE_PATTERN, (match, varKey) => {
    const trimmedKey = varKey.trim()
    const value = resolveVariable(trimmedKey, context)
    return value
  })
}

/**
 * Validate that all variables in content are recognized
 */
export function validateVariables(content: string | object): {
  valid: boolean
  unknown: string[]
  known: string[]
} {
  const variables = extractVariables(content)
  const known: string[] = []
  const unknown: string[] = []
  
  const recognizedPrefixes = ['patient.', 'practice.', 'appointment.', 'links.']
  
  for (const varKey of variables) {
    const isKnown = recognizedPrefixes.some(prefix => varKey.startsWith(prefix))
    if (isKnown) {
      known.push(varKey)
    } else {
      unknown.push(varKey)
    }
  }
  
  return {
    valid: unknown.length === 0,
    unknown,
    known,
  }
}
