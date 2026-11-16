import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft } from 'lucide-react-native';
import { ApiStudent, getStudent } from '../../lib/api';
import { studentAge, studentAvatarColor, studentClass, studentInitials, studentName } from '../../lib/studentDisplay';
import { useAuth } from '../../context/AuthContext';

export default function StudentProfileScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const studentId = Array.isArray(id) ? id[0] : id;
  const [student, setStudent] = useState<ApiStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!studentId || !user?.school_id) return;
    getStudent(user.school_id, studentId).then((record) => {
      if (active) setStudent(record);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this student.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [studentId, user?.school_id]);

  const name = student ? studentName(student) : 'Student';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to students"
        >
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student profile</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.stateBox}><ActivityIndicator color={Colors.primary} /><Text style={styles.detailsText}>Loading student profile…</Text></View>
        ) : error || !student ? (
          <View style={styles.stateBox}><Text style={styles.errorText}>{error || 'Student record not found.'}</Text></View>
        ) : <>
        {/* Live student profile from the school API */}
        <View style={styles.profileSection}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: studentAvatarColor(student) },
            ]}
          >
            <Text style={styles.avatarText}>{studentInitials(student)}</Text>
          </View>
          <Text style={styles.studentName}>{name}</Text>
          <Text style={styles.admissionNumber}>{student.student_code}</Text>
          <Text style={styles.detailsText}>
            {studentClass(student)} · {studentAge(student.date_of_birth)}{student.gender ? ` · ${student.gender}` : ''}
          </Text>
        </View>

        {/* Status and card state */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Status</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    student.is_active
                      ? Colors.secondaryGreen
                      : Colors.absent,
                },
              ]}
            >
              {student.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Card</Text>
            <Text style={styles.statValue}>{student.card_status || 'Not issued'}</Text>
          </View>
        </View>

        <View style={styles.recordsCard}>
          <Text style={styles.recordLabel}>Profile details are read-only in this version.</Text>
        </View>
        </>}
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
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 4,
  },
  backPlaceholder: { width: 44, height: 44 },
  stateBox: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: Colors.absent, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
    gap: 16,
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    marginTop: 6,
  },
  admissionNumber: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  recordsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  recordRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  recordLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
