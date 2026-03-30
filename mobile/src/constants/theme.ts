import { Dimensions, Platform } from 'react-native'

const { width: W } = Dimensions.get('window')
export const rs = (px: number) => Math.round((W / 390) * px)

export const colors = {
  bg:           '#FFFFFF',
  bgSubtle:     '#F7F8FA',
  bgMuted:      '#F0F2F5',
  border:       '#E8EAED',
  borderStrong: '#D1D5DB',
  text:         '#111827',
  textSecondary:'#6B7280',
  textMuted:    '#9CA3AF',
  textDisabled: '#D1D5DB',
  accent:        '#3B6FEA',
  accentLight:   '#EEF3FF',
  accentSurface: '#E0E9FC',
  success:      '#16A34A',
  successLight: '#DCFCE7',
  warning:      '#D97706',
  warningLight: '#FEF3C7',
  error:        '#DC2626',
  errorLight:   '#FEE2E2',
  sms:         '#7C3AED',
  smsLight:    '#EDE9FE',
  email:       '#2563EB',
  emailLight:  '#DBEAFE',
  secure:      '#059669',
  secureLight: '#D1FAE5',
  voice:       '#D97706',
  voiceLight:  '#FEF3C7',
  video:       '#0891B2',
  videoLight:  '#CFFAFE',
  white:    '#FFFFFF',
  black:    '#000000',
  overlay:  'rgba(0,0,0,0.4)',
  surface:  '#FFFFFF',
  primary:  '#0F172A',
  divider:  '#F0F2F5',
  statusOpen:     '#16A34A',
  statusPending:  '#D97706',
  statusResolved: '#9CA3AF',
}

export const spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
}

export const radius = {
  xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, full: 999,
}

export const fontSize = {
  xxs: 10, xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30,
}

export const fontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
}

export const shadow = {
  xs: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
    android: { elevation: 1 },
  }),
  sm: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16 },
    android: { elevation: 4 },
  }),
}
