export const colors = {
  // Brand
  primary: '#0F172A',      // slate-900
  primaryLight: '#1E293B', // slate-800
  accent: '#3B82F6',       // blue-500
  accentLight: '#EFF6FF',  // blue-50

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',   // slate-50
  surface: '#FFFFFF',
  border: '#E2E8F0',       // slate-200
  divider: '#F1F5F9',      // slate-100

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B', // slate-500
  textMuted: '#94A3B8',    // slate-400
  textInverse: '#FFFFFF',

  // Channel badges
  sms: '#8B5CF6',          // violet-500
  email: '#3B82F6',        // blue-500
  secure: '#10B981',       // emerald-500
  voice: '#F59E0B',        // amber-500
  video: '#EC4899',        // pink-500

  // Conversation status
  open: '#10B981',
  pending: '#F59E0B',
  resolved: '#94A3B8',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
} as const

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
}
