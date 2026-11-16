import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { GraduationCap, ChevronDown, Bell, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onSchoolPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  onNotificationPress,
  onProfilePress,
  onSchoolPress,
}) => {
  const { user } = useAuth();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Account';
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'A';
  const schoolName = user?.school?.name || 'Your school';
  const schoolCode = user?.school?.code || 'School account';

  if (showBack) {
    return (
      <View style={styles.headerBack}>
        <TouchableOpacity
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {rightAction ? (
          <View style={styles.rightActionContainer}>{rightAction}</View>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.schoolBadge}
        onPress={onSchoolPress}
        activeOpacity={0.7}
        accessibilityLabel="Switch school"
      >
        <View style={styles.schoolIconBox}>
          <GraduationCap size={22} color={Colors.primary} />
        </View>
        <View style={styles.schoolTextCol}>
          <Text style={styles.schoolName} numberOfLines={1}>
            {schoolName}
          </Text>
          <View style={styles.schoolCodeRow}>
            <Text style={styles.schoolCode}>{schoolCode}</Text>
            <ChevronDown size={14} color={Colors.textSecondary} strokeWidth={2.2} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.circleButton}
        onPress={onNotificationPress}
        activeOpacity={0.7}
        accessibilityLabel="Notifications"
      >
        <Bell size={20} color={Colors.textPrimary} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.avatarButton}
        onPress={onProfilePress}
        activeOpacity={0.8}
        accessibilityLabel={`${displayName} menu`}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  rightActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolBadge: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  schoolIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  schoolCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  schoolCode: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tealAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
});
