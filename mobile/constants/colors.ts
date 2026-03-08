export const Colors = {
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  primaryBg: '#EEF2FF',

  success: '#10B981',
  successBg: '#D1FAE5',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  info: '#3B82F6',
  infoBg: '#DBEAFE',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  white: '#FFFFFF',
  black: '#000000',

  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
}

export const AppointmentStatusColors: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: Colors.infoBg, text: Colors.info },
  confirmed: { bg: Colors.successBg, text: Colors.success },
  completed: { bg: Colors.gray100, text: Colors.gray600 },
  cancelled: { bg: Colors.dangerBg, text: Colors.danger },
  no_show: { bg: Colors.warningBg, text: Colors.warning },
}

export const TaskStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: Colors.warningBg, text: Colors.warning },
  in_progress: { bg: Colors.infoBg, text: Colors.info },
  completed: { bg: Colors.successBg, text: Colors.success },
  cancelled: { bg: Colors.gray100, text: Colors.gray600 },
  on_hold: { bg: Colors.gray100, text: Colors.gray500 },
}

export const TaskPriorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: Colors.gray100, text: Colors.gray600 },
  normal: { bg: Colors.infoBg, text: Colors.info },
  high: { bg: Colors.warningBg, text: Colors.warning },
  urgent: { bg: Colors.dangerBg, text: Colors.danger },
}

export const ChannelColors: Record<string, { bg: string; text: string }> = {
  sms: { bg: Colors.successBg, text: Colors.success },
  email: { bg: Colors.infoBg, text: Colors.info },
  secure: { bg: Colors.primaryBg, text: Colors.primary },
  voice: { bg: Colors.warningBg, text: Colors.warning },
  video: { bg: Colors.dangerBg, text: Colors.danger },
}
