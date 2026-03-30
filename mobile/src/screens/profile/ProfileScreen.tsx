import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { colors, fontSize, fontWeight, radius, spacing, shadow, rs } from '@/constants/theme'

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  )
}

interface MenuRowProps {
  icon: string
  label: string
  value?: string
  onPress?: () => void
  destructive?: boolean
}

function MenuRow({ icon, label, value, onPress, destructive }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.menuIcon, destructive && styles.menuIconDestructive]}>
        <Ionicons
          name={icon as any}
          size={rs(18)}
          color={destructive ? colors.error : colors.accent}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
        {value ? <Text style={styles.menuValue} numberOfLines={1}>{value}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}

export function ProfileScreen() {
  const { user, logout, isLoading } = useAuthStore()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true)
            try {
              await logout()
            } finally {
              setLoggingOut(false)
            }
          },
        },
      ]
    )
  }

  // Show spinner while auth is initialising
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    )
  }

  // No user at all — show a minimal logout-only screen
  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SESSION</Text>
            <View style={styles.card}>
              <MenuRow
                icon="log-out-outline"
                label={loggingOut ? 'Logging out…' : 'Log out'}
                onPress={loggingOut ? undefined : handleLogout}
                destructive
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const displayName = user.name || user.email
  const roleLabel = user.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : 'Member'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User card */}
        <View style={[styles.card, styles.userCard]}>
          <InitialAvatar name={displayName} />
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        {/* Practice section */}
        {user.practiceName ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PRACTICE</Text>
            <View style={styles.card}>
              <MenuRow
                icon="business-outline"
                label={user.practiceName}
                value="Current practice"
              />
            </View>
          </View>
        ) : null}

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            <MenuRow icon="mail-outline" label="Email" value={user.email} />
            <View style={styles.divider} />
            <MenuRow icon="shield-checkmark-outline" label="Role" value={roleLabel} />
          </View>
        </View>

        {/* Actions section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION</Text>
          <View style={styles.card}>
            <MenuRow
              icon="log-out-outline"
              label={loggingOut ? 'Logging out…' : 'Log out'}
              onPress={loggingOut ? undefined : handleLogout}
              destructive
            />
          </View>
        </View>

        <Text style={styles.appVersion}>VantageAI · Medical CRM</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const ICON_SIZE = rs(34)

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xl,
    marginTop: Platform.OS === 'android' ? spacing.xl : spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
    padding: spacing.md,
  },
  avatar: {
    width: rs(60),
    height: rs(60),
    borderRadius: rs(30),
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  // Card
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },

  // Menu row
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: rs(52),
  },
  menuIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuIconDestructive: {
    backgroundColor: colors.errorLight,
  },
  menuContent: { flex: 1 },
  menuLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  menuLabelDestructive: { color: colors.error },
  menuValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: ICON_SIZE + spacing.md * 2,
  },

  appVersion: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
})
