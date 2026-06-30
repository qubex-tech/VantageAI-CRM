import { describe, it, expect } from 'vitest'
import {
  isVantageAdmin,
  isPracticeAdmin,
  isRegularUser,
  canConfigureAPIs,
  canManagePractice,
  canManageUsers,
  canAccessPractice,
  canUseCRM,
  getUserPracticeId,
  requirePermission,
  type User,
} from '@/lib/permissions'

describe('Permission Utilities', () => {
  // Test users for different roles
  const vantageAdmin: User = {
    id: 'vantage-admin-1',
    email: 'admin@vantage.com',
    name: 'Vantage Admin',
    practiceId: null,
    role: 'vantage_admin',
  }

  const practiceAdmin: User = {
    id: 'practice-admin-1',
    email: 'admin@practice.com',
    name: 'Practice Admin',
    practiceId: 'practice-123',
    role: 'practice_admin',
  }

  const regularUser: User = {
    id: 'regular-user-1',
    email: 'user@practice.com',
    name: 'Regular User',
    practiceId: 'practice-123',
    role: 'regular_user',
  }

  const staffUser: User = {
    id: 'staff-1',
    email: 'staff@practice.com',
    name: 'Staff Member',
    practiceId: 'practice-123',
    role: 'staff',
  }

  describe('isVantageAdmin', () => {
    it('should return true for vantage_admin role', () => {
      expect(isVantageAdmin(vantageAdmin)).toBe(true)
    })

    it('should return false for practice_admin role', () => {
      expect(isVantageAdmin(practiceAdmin)).toBe(false)
    })

    it('should return false for regular_user role', () => {
      expect(isVantageAdmin(regularUser)).toBe(false)
    })

    it('should return false for staff role', () => {
      expect(isVantageAdmin(staffUser)).toBe(false)
    })
  })

  describe('isPracticeAdmin', () => {
    it('should return true for practice_admin role', () => {
      expect(isPracticeAdmin(practiceAdmin)).toBe(true)
    })

    it('should return false for vantage_admin role', () => {
      expect(isPracticeAdmin(vantageAdmin)).toBe(false)
    })

    it('should return false for regular_user role', () => {
      expect(isPracticeAdmin(regularUser)).toBe(false)
    })
  })

  describe('isRegularUser', () => {
    it('should return true for regular_user role', () => {
      expect(isRegularUser(regularUser)).toBe(true)
    })

    it('should return false for vantage_admin role', () => {
      expect(isRegularUser(vantageAdmin)).toBe(false)
    })

    it('should return false for practice_admin role', () => {
      expect(isRegularUser(practiceAdmin)).toBe(false)
    })
  })

  describe('canConfigureAPIs', () => {
    it('should return true for vantage_admin', () => {
      expect(canConfigureAPIs(vantageAdmin)).toBe(true)
    })

    it('should return false for practice_admin', () => {
      expect(canConfigureAPIs(practiceAdmin)).toBe(false)
    })

    it('should return false for regular_user', () => {
      expect(canConfigureAPIs(regularUser)).toBe(false)
    })

    it('should return false for staff', () => {
      expect(canConfigureAPIs(staffUser)).toBe(false)
    })
  })

  describe('canManagePractice', () => {
    it('should return true for vantage_admin for any practice', () => {
      expect(canManagePractice(vantageAdmin, 'practice-123')).toBe(true)
      expect(canManagePractice(vantageAdmin, 'practice-456')).toBe(true)
      expect(canManagePractice(vantageAdmin)).toBe(true)
    })

    it('should return true for practice_admin for their own practice', () => {
      expect(canManagePractice(practiceAdmin, 'practice-123')).toBe(true)
    })

    it('should return false for practice_admin for different practice', () => {
      expect(canManagePractice(practiceAdmin, 'practice-456')).toBe(false)
    })

    it('should return true for practice_admin when no practiceId specified', () => {
      expect(canManagePractice(practiceAdmin)).toBe(true)
    })

    it('should return false for regular_user', () => {
      expect(canManagePractice(regularUser, 'practice-123')).toBe(false)
      expect(canManagePractice(regularUser)).toBe(false)
    })

    it('should return false for staff', () => {
      expect(canManagePractice(staffUser, 'practice-123')).toBe(false)
    })
  })

  describe('canManageUsers', () => {
    it('should return true for vantage_admin for any practice', () => {
      expect(canManageUsers(vantageAdmin, 'practice-123')).toBe(true)
      expect(canManageUsers(vantageAdmin, 'practice-456')).toBe(true)
      expect(canManageUsers(vantageAdmin)).toBe(true)
    })

    it('should return true for practice_admin for their own practice', () => {
      expect(canManageUsers(practiceAdmin, 'practice-123')).toBe(true)
    })

    it('should return false for practice_admin for different practice', () => {
      expect(canManageUsers(practiceAdmin, 'practice-456')).toBe(false)
    })

    it('should return true for practice_admin when no practiceId specified', () => {
      expect(canManageUsers(practiceAdmin)).toBe(true)
    })

    it('should return false for regular_user', () => {
      expect(canManageUsers(regularUser, 'practice-123')).toBe(false)
      expect(canManageUsers(regularUser)).toBe(false)
    })

    it('should return false for staff', () => {
      expect(canManageUsers(staffUser, 'practice-123')).toBe(false)
    })
  })

  describe('canAccessPractice', () => {
    it('should return true for vantage_admin for any practice', () => {
      expect(canAccessPractice(vantageAdmin, 'practice-123')).toBe(true)
      expect(canAccessPractice(vantageAdmin, 'practice-456')).toBe(true)
      expect(canAccessPractice(vantageAdmin, 'any-practice-id')).toBe(true)
    })

    it('should return true for practice_admin for their own practice', () => {
      expect(canAccessPractice(practiceAdmin, 'practice-123')).toBe(true)
    })

    it('should return false for practice_admin for different practice', () => {
      expect(canAccessPractice(practiceAdmin, 'practice-456')).toBe(false)
    })

    it('should return true for regular_user for their own practice', () => {
      expect(canAccessPractice(regularUser, 'practice-123')).toBe(true)
    })

    it('should return false for regular_user for different practice', () => {
      expect(canAccessPractice(regularUser, 'practice-456')).toBe(false)
    })

    it('should return true for staff for their own practice', () => {
      expect(canAccessPractice(staffUser, 'practice-123')).toBe(true)
    })

    it('should return false for staff for different practice', () => {
      expect(canAccessPractice(staffUser, 'practice-456')).toBe(false)
    })
  })

  describe('canUseCRM', () => {
    it('should return true for all authenticated users', () => {
      expect(canUseCRM(vantageAdmin)).toBe(true)
      expect(canUseCRM(practiceAdmin)).toBe(true)
      expect(canUseCRM(regularUser)).toBe(true)
      expect(canUseCRM(staffUser)).toBe(true)
    })
  })

  describe('getUserPracticeId', () => {
    it('should return null for vantage_admin', () => {
      expect(getUserPracticeId(vantageAdmin)).toBeNull()
    })

    it('should return practiceId for practice_admin', () => {
      expect(getUserPracticeId(practiceAdmin)).toBe('practice-123')
    })

    it('should return practiceId for regular_user', () => {
      expect(getUserPracticeId(regularUser)).toBe('practice-123')
    })

    it('should return practiceId for staff', () => {
      expect(getUserPracticeId(staffUser)).toBe('practice-123')
    })

    it('should return null for user with null practiceId', () => {
      const userWithNoPractice: User = {
        ...regularUser,
        practiceId: null,
      }
      expect(getUserPracticeId(userWithNoPractice)).toBeNull()
    })
  })

  describe('requirePermission', () => {
    it('should not throw when permission check passes', () => {
      expect(() => {
        requirePermission(vantageAdmin, isVantageAdmin)
      }).not.toThrow()
    })

    it('should throw when permission check fails', () => {
      expect(() => {
        requirePermission(regularUser, isVantageAdmin)
      }).toThrow('Permission denied')
    })

    it('should throw with custom error message', () => {
      expect(() => {
        requirePermission(regularUser, isVantageAdmin, 'Admin access required')
      }).toThrow('Admin access required')
    })

    it('should work with complex permission checks', () => {
      const checkCanAccessPractice = (user: User) => canAccessPractice(user, 'practice-123')
      
      expect(() => {
        requirePermission(practiceAdmin, checkCanAccessPractice)
      }).not.toThrow()

      expect(() => {
        requirePermission(
          { ...practiceAdmin, practiceId: 'different-practice' },
          checkCanAccessPractice
        )
      }).toThrow()
    })
  })

  describe('Role combinations', () => {
    it('should handle user without practice gracefully', () => {
      const orphanUser: User = {
        id: 'orphan-1',
        email: 'orphan@example.com',
        name: 'Orphan User',
        practiceId: null,
        role: 'regular_user',
      }

      expect(canAccessPractice(orphanUser, 'any-practice')).toBe(false)
      expect(canManagePractice(orphanUser)).toBe(false)
      expect(getUserPracticeId(orphanUser)).toBeNull()
    })

    it('should handle legacy admin role', () => {
      const legacyAdmin: User = {
        id: 'legacy-admin-1',
        email: 'legacy@practice.com',
        name: 'Legacy Admin',
        practiceId: 'practice-123',
        role: 'admin', // legacy role
      }

      // Legacy admin is not vantage_admin or practice_admin
      expect(isVantageAdmin(legacyAdmin)).toBe(false)
      expect(isPracticeAdmin(legacyAdmin)).toBe(false)
      expect(canConfigureAPIs(legacyAdmin)).toBe(false)
      
      // But can access their practice
      expect(canAccessPractice(legacyAdmin, 'practice-123')).toBe(true)
    })

    it('should handle provider role', () => {
      const provider: User = {
        id: 'provider-1',
        email: 'doctor@practice.com',
        name: 'Dr. Smith',
        practiceId: 'practice-123',
        role: 'provider',
      }

      expect(canAccessPractice(provider, 'practice-123')).toBe(true)
      expect(canAccessPractice(provider, 'practice-456')).toBe(false)
      expect(canUseCRM(provider)).toBe(true)
    })
  })
})
