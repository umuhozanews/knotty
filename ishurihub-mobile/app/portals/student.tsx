import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, CreditCard, Home, Calendar, Wallet, BookOpen, User } from 'lucide-react-native';
import { MOCK_STUDENTS } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function StudentPortalScreen() {
  const [activePortalTab, setActivePortalTab] = useState('Home');
  const student = MOCK_STUDENTS[0]; // Tumukunde Josiane

  const schoolLifeRows = [
    { label: 'Today’s attendance', value: student.attendanceToday || 'Not scanned' },
    { label: 'Library books', value: `${student.libraryBooksCount}` },
    { label: 'Discipline records', value: `${student.disciplineRecordsCount}` },
    { label: 'Health visits', value: `${student.healthVisitsCount}` },
  ];

  const tabs = [
    { label: 'Home', icon: Home },
    { label: 'Attendance', icon: Calendar },
    { label: 'Wallet', icon: Wallet },
    { label: 'Library', icon: BookOpen },
    { label: 'Profile', icon: User },
  ];

  const handleShowCard = () => {
    Alert.alert(
      'My Smart ID Card',
      `Card ID: ${student.admissionNumber}\nStudent: ${student.name}\nClass: ${student.class}\nStatus: ${student.status}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.initials}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.className}>{student.class}</Text>
          <Text style={styles.admissionNumber}>{student.admissionNumber}</Text>
        </View>
        <TouchableOpacity
          style={styles.cardBtn}
          onPress={handleShowCard}
          activeOpacity={0.7}
        >
          <CreditCard size={14} color={Colors.secondaryGreen} />
          <Text style={styles.cardBtnText}>Show my card</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Student portal information is preview data; it is not linked to your student account yet.</PreviewNotice>
        {/* Balance & Points Cards */}
        <View style={styles.balanceGrid}>
          <View style={styles.canteenCard}>
            <Text style={styles.canteenAmount}>{student.balance} RWF</Text>
            <Text style={styles.canteenLabel}>Canteen balance</Text>
          </View>
          <View style={styles.pointsCard}>
            <Text style={styles.pointsAmount}>{student.attendancePoints} pts</Text>
            <Text style={styles.pointsLabel}>Attendance points</Text>
          </View>
        </View>

        {/* My School Life Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My school life</Text>
          <View style={styles.recordsCard}>
            {schoolLifeRows.map((r, i) => {
              const isLast = i === schoolLifeRows.length - 1;
              return (
                <View
                  key={r.label}
                  style={[styles.recordRow, !isLast && styles.recordRowBorder]}
                >
                  <Text style={styles.recordLabel}>{r.label}</Text>
                  <Text style={styles.recordValue}>{r.value}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Student Portal Bottom Nav */}
      <View style={styles.bottomNav}>
        {tabs.map((t) => {
          const isActive = activePortalTab === t.label;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.label}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => setActivePortalTab(t.label)}
              activeOpacity={0.7}
            >
              <Icon
                size={20}
                color={isActive ? Colors.primaryDark : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.navLabel,
                  isActive ? styles.navLabelActive : styles.navLabelInactive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.studentAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  metaCol: {
    flex: 1,
    gap: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  className: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  admissionNumber: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardBtn: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  canteenCard: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 86,
  },
  canteenAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  canteenLabel: {
    fontSize: 13,
    color: Colors.primaryTextLight,
    fontWeight: '600',
  },
  pointsCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 86,
  },
  pointsAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pointsLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recordRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  recordLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navItem: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  navLabel: {
    fontSize: 11,
  },
  navLabelActive: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  navLabelInactive: {
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
