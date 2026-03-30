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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { colors, fontSize, fontWeight, radius, spacing, shadow, rs } from '@/constants/theme'

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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
  showChevron?: boolean
}

function MenuRow({ icon, label, value, onPress, destructive, showChevron }: MenuRowProps) {
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
        {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={rs(16)} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  )
}

export function ProfileScreen() {
  const { user, logout } = useAuthStore()
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

  if (!user) return null

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
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
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
            <MenuRow
              icon="mail-outline"
              label="Email"
              value={user.email}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="shield-checkmark-outline"
              label="Role"
              value={roleLabel}
            />
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
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
  },
  avatar: {
    width: rs(60),
    height: rs(60),
    borderRadius: rs(30),
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  userInfo: {
    flex: 1,
  },
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
  section: {
    marginBottom: spacing.xl,
  },
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
    padding: spacing.md,
    gap: spacing.md,
    minHeight: rs(52),
  },
  menuIcon: {
    width: rs(34),
    height: rs(34),
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDestructive: {
    backgroundColor: colors.errorLight,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  menuLabelDestructive: {
    color: colors.error,
  },
  menuValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: rs(34) + spacing.md * 2,
  },

  appVersion: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
})
