import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { Bell, ArrowLeft, ChevronRight } from 'lucide-react-native';
import { SCHOOL_INFO, MOCK_STUDENTS, MOCK_WORKERS } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function SchoolAdminPortalScreen() {
  const attendanceStats = [
    { label: 'Present', value: 0, color: Colors.secondaryGreen },
    { label: 'Absent', value: 0, color: Colors.absent },
    { label: 'Late', value: 0, color: Colors.late },
    { label: 'Excused', value: 0, color: Colors.excused },
  ];

  const overviewRows = [
    { label: 'Canteen sales today', value: '0 RWF', color: Colors.secondaryGreen, route: '/canteen' },
    { label: 'Overdue library books', value: '0', color: Colors.textPrimary, route: '/library' },
    { label: 'Pending library fines', value: '0 RWF', color: Colors.textPrimary, route: '/library' },
    { label: 'Discipline records', value: '0', color: Colors.textPrimary, route: '/discipline' },
  ];

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
          <Text style={styles.avatarText}>AU</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.schoolSubText}>
            {SCHOOL_INFO.name} · {SCHOOL_INFO.code}
          </Text>
          <Text style={styles.title}>School Admin</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => Alert.alert('Notifications', 'No admin alerts.')}
          activeOpacity={0.7}
        >
          <Bell size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>This admin portal is a preview. Only student records and today’s attendance summary are connected.</PreviewNotice>
        {/* Attendance Today Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance today</Text>
          <View style={styles.statsGrid}>
            {attendanceStats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statNumber}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* School Totals */}
        <View style={styles.totalsGrid}>
          <TouchableOpacity
            style={styles.totalCard}
            onPress={() => router.push('/(tabs)/students')}
            activeOpacity={0.7}
          >
            <Text style={styles.totalNumber}>{MOCK_STUDENTS.length}</Text>
            <Text style={styles.totalLabel}>Students</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.totalCard}
            onPress={() => router.push('/(tabs)/workers')}
            activeOpacity={0.7}
          >
            <Text style={styles.totalNumber}>{MOCK_WORKERS.length}</Text>
            <Text style={styles.totalLabel}>Staff</Text>
          </TouchableOpacity>
        </View>

        {/* School Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School overview</Text>
          <View style={styles.overviewCard}>
            {overviewRows.map((r, i) => {
              const isLast = i === overviewRows.length - 1;
              return (
                <TouchableOpacity
                  key={r.label}
                  style={[styles.overviewRow, !isLast && styles.overviewRowBorder]}
                  onPress={() => r.route && router.push(r.route as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.overviewRowLabel}>{r.label}</Text>
                  <View style={styles.overviewRowRight}>
                    <Text style={[styles.overviewRowValue, { color: r.color }]}>
                      {r.value}
                    </Text>
                    <ChevronRight size={16} color={Colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
  metaCol: {
    flex: 1,
    gap: 1,
  },
  schoolSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  totalNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  overviewCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overviewRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  overviewRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  overviewRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewRowValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});
