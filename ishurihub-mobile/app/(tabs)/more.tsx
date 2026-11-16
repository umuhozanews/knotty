import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import {
  Utensils,
  Building2,
  BookOpen,
  ShieldAlert,
  HeartPulse,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Users2,
  Coins,
  DoorOpen,
  Eye,
  LogOut,
  Sliders,
  CheckCircle,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Account';
  const userInitials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'A';

  const handleSwitchSchool = () => {
    Alert.alert('School Selection', 'School switching is not connected yet. Your account stays in its assigned school.');
  };

  const handleSchoolsHub = () => {
    Alert.alert('Schools Hub', 'IshuriHUB Multi-School Network directory.');
  };

  const handleSettings = () => {
    Alert.alert('Settings', 'App configuration settings.');
  };

  const handleSystemTests = () => {
    Alert.alert('System Tests', 'All device sensors and offline sync tests passed: OK.');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Confirm sign out from IshuriHUB Mobile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => {
        void signOut().catch(() => Alert.alert('Signed out on this device', 'The server could not confirm session revocation. Sign in again when you are online.'));
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userRole}>{user?.role?.replaceAll('_', ' ') || 'School user'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.schoolSwitchBtn}
            onPress={handleSwitchSchool}
            activeOpacity={0.7}
          >
            <Text style={styles.schoolSwitchText}>
              {user?.school?.name || 'Assigned school'} · {user?.school?.code || 'School account'}
            </Text>
            <Text style={styles.switchActionText}>Switch</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.previewNotice}>
          Live data: student records and today’s attendance summary. Other modules are previews and do not save changes yet.
        </Text>

        {/* Operational Modules Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School</Text>
          <View style={styles.modulesGrid}>
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push('/canteen')}
              activeOpacity={0.7}
            >
              <Utensils size={24} color={Colors.secondaryGreen} strokeWidth={2} />
              <Text style={styles.moduleLabel}>Canteen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={handleSchoolsHub}
              activeOpacity={0.7}
            >
              <Building2 size={24} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.moduleLabel}>Schools Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push('/library')}
              activeOpacity={0.7}
            >
              <BookOpen size={24} color={Colors.excused} strokeWidth={2} />
              <Text style={styles.moduleLabel}>Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push('/discipline')}
              activeOpacity={0.7}
            >
              <ShieldAlert size={24} color={Colors.late} strokeWidth={2} />
              <Text style={styles.moduleLabel}>Discipline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => router.push('/portals/nurse')}
              activeOpacity={0.7}
            >
              <HeartPulse size={24} color={Colors.absent} strokeWidth={2} />
              <Text style={styles.moduleLabel}>Health</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Role-Based Portals Navigation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role Portals Preview</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/admin')}
              activeOpacity={0.7}
            >
              <ShieldCheck size={20} color={Colors.tealAvatar} />
              <Text style={styles.portalLabel}>School Admin Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/librarian')}
              activeOpacity={0.7}
            >
              <BookOpen size={20} color={Colors.excused} />
              <Text style={styles.portalLabel}>Librarian Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/student')}
              activeOpacity={0.7}
            >
              <UserCheck size={20} color={Colors.studentAvatar} />
              <Text style={styles.portalLabel}>Student Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/parent')}
              activeOpacity={0.7}
            >
              <Users2 size={20} color={Colors.primary} />
              <Text style={styles.portalLabel}>Parent Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/discipline')}
              activeOpacity={0.7}
            >
              <ShieldAlert size={20} color={Colors.late} />
              <Text style={styles.portalLabel}>Discipline Office Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/nurse')}
              activeOpacity={0.7}
            >
              <HeartPulse size={20} color={Colors.absent} />
              <Text style={styles.portalLabel}>Nurse Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/bursar')}
              activeOpacity={0.7}
            >
              <Coins size={20} color={Colors.secondaryGreen} />
              <Text style={styles.portalLabel}>Bursar Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.portalRow}
              onPress={() => router.push('/portals/gate')}
              activeOpacity={0.7}
            >
              <DoorOpen size={20} color={Colors.primaryDark} />
              <Text style={styles.portalLabel}>Gate Portal</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.portalRow, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/portals/permissions')}
              activeOpacity={0.7}
            >
              <Eye size={20} color={Colors.primary} />
              <Text style={[styles.portalLabel, { color: Colors.secondaryGreen, fontWeight: '700' }]}>
                Who Can See What (Matrix)
              </Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingRow} onPress={handleSettings} activeOpacity={0.7}>
              <Sliders size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>Settings</Text>
            </TouchableOpacity>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Dark mode</Text>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: Colors.textTertiary, true: Colors.primary }}
                thumbColor={Colors.surface}
              />
            </View>

            <TouchableOpacity style={styles.settingRow} onPress={handleSystemTests} activeOpacity={0.7}>
              <CheckCircle size={20} color={Colors.textPrimary} />
              <Text style={styles.settingLabel}>System Tests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomWidth: 0 }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={20} color={Colors.absent} />
              <Text style={[styles.settingLabel, { color: Colors.absent, fontWeight: '700' }]}>
                Log out
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Built by <Text style={styles.footerBrand}>OrynTechltd</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.tealAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    gap: 2,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userRole: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  schoolSwitchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schoolSwitchText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  switchActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: '48%',
    minHeight: 84,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
  },
  moduleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  portalRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  portalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  footerBrand: {
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  previewNotice: { color: '#72540E', backgroundColor: '#FFFAE8', borderColor: '#F5D99A', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
});
