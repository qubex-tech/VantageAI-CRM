/**
 * Permission checking utilities for role-based access control
 */

export type UserRole = 'vantage_admin' | 'practice_admin' | 'regular_user' | 'admin' | 'staff' | 'provider'

export interface User {
  id: string
  email: string
  name: string | null
  practiceId: string | null
  role: string
}

/**
 * Check if user is a Vantage Admin (system-level admin)
 */
export function isVantageAdmin(user: User): boolean {
  return user.role === 'vantage_admin'
}

/**
 * Check if user is a Practice Admin
 */
export function isPracticeAdmin(user: User): boolean {
  return user.role === 'practice_admin'
}

/**
 * Check if user is a Regular User
 */
export function isRegularUser(user: User): boolean {
  return user.role === 'regular_user'
}

/**
 * Check if user can configure API integrations (Cal.com, RetellAI, SendGrid/Twilio)
 * Only Vantage Admins can configure APIs
 */
export function canConfigureAPIs(user: User): boolean {
  return isVantageAdmin(user)
}

/**
 * Check if user can manage practice information (practice name, users)
 * Vantage Admins and Practice Admins can manage practices
 */
export function canManagePractice(user: User, practiceId?: string): boolean {
  if (isVantageAdmin(user)) {
    return true // Vantage admins can manage any practice
  }
  if (isPracticeAdmin(user)) {
    // Practice admins can only manage their own practice
    return practiceId ? user.practiceId === practiceId : !!user.practiceId
  }
  return false
}

/**
 * Check if user can manage users (create/edit/delete users)
 * Vantage Admins and Practice Admins can manage users
 */
export function canManageUsers(user: User, targetPracticeId?: string): boolean {
  if (isVantageAdmin(user)) {
    return true // Vantage admins can manage users in any practice
  }
  if (isPracticeAdmin(user)) {
    // Practice admins can only manage users in their own practice
    return targetPracticeId ? user.practiceId === targetPracticeId : !!user.practiceId
  }
  return false
}

/**
 * Check if user can access practice data
 * Vantage Admins can access all practices
 * Practice Admins and Regular Users can only access their own practice
 */
export function canAccessPractice(user: User, practiceId: string): boolean {
  if (isVantageAdmin(user)) {
    return true
  }
  return user.practiceId === practiceId
}

/**
 * Check if user can view/use CRM features
 * All authenticated users can use the CRM, but data is filtered by practice
 */
export function canUseCRM(user: User): boolean {
  return true // All authenticated users can use the CRM
}

/**
 * Get the practice ID that the user should access
 * For Vantage Admins, returns null (can access all)
 * For others, returns their practiceId
 */
export function getUserPracticeId(user: User): string | null {
  if (isVantageAdmin(user)) {
    return null // Vantage admins can access all practices
  }
  return user.practiceId
}

/**
 * Require that user has a specific permission
 * Throws an error if permission check fails
 */
export function requirePermission(
  user: User,
  check: (user: User) => boolean,
  errorMessage: string = 'Permission denied'
): void {
  if (!check(user)) {
    throw new Error(errorMessage)
  }
}
