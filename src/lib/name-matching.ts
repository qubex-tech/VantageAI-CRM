/**
 * Name matching utilities for patient portal authentication
 * Handles flexible name matching to support variations like:
 * - "John Doe" vs "John A. Doe"
 * - "Mary Jane Smith" vs "Mary J. Smith"
 * - Case-insensitive matching
 */

/**
 * Normalize a name for comparison
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove common punctuation
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,\-']/g, '') // Remove common punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
}

/**
 * Extract first and last name from full name
 */
export function parseFullName(fullName: string): { first: string; last: string } {
  const normalized = normalizeName(fullName)
  const parts = normalized.split(/\s+/).filter(p => p.length > 0)
  
  if (parts.length === 0) {
    return { first: '', last: '' }
  }
  
  if (parts.length === 1) {
    return { first: parts[0], last: '' }
  }
  
  // Last part is last name, everything else is first name
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  
  return { first, last }
}

/**
 * Check if two names match (flexible matching)
 * Supports:
 * - Exact match after normalization
 * - First name + last name match
 * - Partial matches (e.g., "John" matches "John A.")
 */
export function namesMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1)
  const norm2 = normalizeName(name2)
  
  // Exact match
  if (norm1 === norm2) {
    return true
  }
  
  // Parse both names
  const parsed1 = parseFullName(name1)
  const parsed2 = parseFullName(name2)
  
  // Both must have at least first name
  if (!parsed1.first || !parsed2.first) {
    return false
  }
  
  // First names must match (exact or one starts with the other)
  const firstMatch = 
    parsed1.first === parsed2.first ||
    parsed1.first.startsWith(parsed2.first) ||
    parsed2.first.startsWith(parsed1.first)
  
  if (!firstMatch) {
    return false
  }
  
  // If both have last names, they must match
  if (parsed1.last && parsed2.last) {
    return parsed1.last === parsed2.last
  }
  
  // If only one has a last name, that's okay (flexible matching)
  return true
}

/**
 * Check if a patient's name matches the provided full name
 * Checks against name, firstName+lastName, or preferredName
 */
export function patientNameMatches(
  patient: {
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
  },
  providedFullName: string
): boolean {
  // Check against full name field
  if (patient.name && namesMatch(patient.name, providedFullName)) {
    return true
  }
  
  // Check against preferred name
  if (patient.preferredName && namesMatch(patient.preferredName, providedFullName)) {
    return true
  }
  
  // Check against firstName + lastName
  if (patient.firstName || patient.lastName) {
    const patientFullName = [patient.firstName, patient.lastName]
      .filter(Boolean)
      .join(' ')
    
    if (patientFullName && namesMatch(patientFullName, providedFullName)) {
      return true
    }
  }
  
  return false
}
