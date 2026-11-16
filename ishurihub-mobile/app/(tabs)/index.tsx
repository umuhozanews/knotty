import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppHeader } from '../../components/AppHeader';
import { AttendanceSummary, SchoolTotals } from '../../components/StatCard';
import { Colors } from '../../constants/theme';
import { ScanLine, TrendingUp, Users } from 'lucide-react-native';
import { ApiStudent, AttendanceSummaryResponse, getAttendanceSummary, getStudents } from '../../lib/api';
import { studentAvatarColor, studentClass, studentInitials, studentName } from '../../lib/studentDisplay';
import { useAuth } from '../../context/AuthContext';

export default function HomeScreen() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceSummaryResponse | null>(null);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [studentTotal, setStudentTotal] = useState<number | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user?.school_id) return () => { active = false; };
    getAttendanceSummary(user.school_id).then((result) => {
      if (active) setAttendance(result);
    }).catch((cause) => {
      if (active) setAttendanceError(cause instanceof Error ? cause.message : 'Unable to load attendance summary.');
    });
    getStudents(user.school_id, '', 5).then((result) => {
      if (active) {
        setStudents(result.students);
        setStudentTotal(result.total);
      }
    }).catch((cause) => {
      if (active) setStudentError(cause instanceof Error ? cause.message : 'Unable to load students.');
    }).finally(() => {
      if (active) setLoadingStudents(false);
    });
    return () => { active = false; };
  }, [reloadKey, user?.school_id]);

  const handleStartScanning = () => {
    router.push('/(tabs)/attendance');
  };

  const handleSwitchSchool = () => {
    Alert.alert('School Selection', 'School switching is not connected yet. Your account stays in its assigned school.');
  };

  const handleNotifications = () => {
    Alert.alert('Notifications', 'Notifications are not connected in this version.');
  };

  const handleProfilePress = () => {
    router.push('/(tabs)/more');
  };

  const reloadDashboard = () => {
    setAttendanceError(null);
    setStudentError(null);
    setLoadingStudents(true);
    setReloadKey((key) => key + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        onSchoolPress={handleSwitchSchool}
        onNotificationPress={handleNotifications}
        onProfilePress={handleProfilePress}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & Title */}
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kigali' }).format(new Date())}</Text>
          <Text style={styles.todayTitle}>Today</Text>
        </View>

        {/* Hero Card: Attendance */}
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroTitle}>Attendance</Text>
            <Text style={styles.heroSubtitle}>Today’s attendance summary</Text>
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleStartScanning}
            activeOpacity={0.85}
          >
            <ScanLine size={22} color={Colors.primaryDark} strokeWidth={2.2} />
            <Text style={styles.scanButtonText}>Start scanning</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <AttendanceSummary
          scannedCount={attendance?.total}
          presentCount={attendance?.summary.PRESENT ?? null}
          absentCount={attendance?.summary.ABSENT ?? null}
          lateCount={attendance?.summary.LATE ?? null}
          excusedCount={attendance?.summary.EXCUSED ?? null}
          loading={!attendance && !attendanceError}
        />
        {attendanceError ? (
          <View>
            <Text style={styles.loadError}>{attendanceError}</Text>
            <TouchableOpacity onPress={reloadDashboard}><Text style={styles.retryLink}>Try again</Text></TouchableOpacity>
          </View>
        ) : null}

        {/* School Totals */}
        <SchoolTotals
          studentsCount={studentTotal}
          workersCount={null}
          onPressStudents={() => router.push('/(tabs)/students')}
          onPressWorkers={() => router.push('/(tabs)/workers')}
        />

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <View>
              <Text style={styles.panelTitle}>Attendance trend · preview</Text>
              <Text style={styles.panelHint}>Sample week; live history isn’t connected yet</Text>
            </View>
            <TrendingUp size={19} color={Colors.primary} />
          </View>
          <View style={styles.chart}>
            {[
              { day: 'M', present: 78, absent: 15 },
              { day: 'T', present: 88, absent: 10 },
              { day: 'W', present: 72, absent: 20 },
              { day: 'T', present: 94, absent: 6 },
              { day: 'F', present: 83, absent: 12 },
            ].map((item, index) => (
              <View key={`${item.day}-${index}`} style={styles.chartColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barPresent, { height: `${item.present}%` }]} />
                </View>
                <Text style={styles.chartLabel}>{item.day}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendDot} />
            <Text style={styles.panelHint}>Present</Text>
            <View style={[styles.legendDot, styles.absenceDot]} />
            <Text style={styles.panelHint}>Absent</Text>
            <Text style={styles.weeklyAverage}>83% average</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <View>
              <Text style={styles.panelTitle}>Course statistics · preview</Text>
              <Text style={styles.panelHint}>Sample figures only</Text>
            </View>
            <Users size={19} color={Colors.primary} />
          </View>
          {[
            { label: 'Attendance', value: 83 },
            { label: 'Fees collected', value: 68 },
            { label: 'Students active', value: 92 },
          ].map((item) => (
            <View key={item.label} style={styles.progressItem}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>{item.label}</Text>
                <Text style={styles.progressValue}>{item.value}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${item.value}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeading}>
            <Text style={styles.panelTitle}>Students at your school</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/students')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {loadingStudents ? <ActivityIndicator color={Colors.primary} /> : null}
          {studentError ? (
            <View>
              <Text style={styles.loadError}>{studentError}</Text>
              <TouchableOpacity onPress={reloadDashboard}><Text style={styles.retryLink}>Try again</Text></TouchableOpacity>
            </View>
          ) : null}
          {!loadingStudents && !studentError && students.length === 0 ? <Text style={styles.panelHint}>No students to show.</Text> : null}
          {students.map((student, index) => (
            <View key={student.id} style={[styles.studentRow, index === 0 && styles.firstStudentRow]}>
              <View style={[styles.avatar, { backgroundColor: studentAvatarColor(student) }]}>
                <Text style={styles.avatarText}>{studentInitials(student)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{studentName(student)}</Text>
                <Text style={styles.panelHint}>{studentClass(student)}</Text>
              </View>
              <Text style={student.is_active ? styles.activeTag : styles.inactiveTag}>{student.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          ))}
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
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
    gap: 20,
    paddingBottom: 24,
  },
  dateBlock: {
    gap: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  todayTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.primaryTextLight,
    marginTop: 3,
  },
  scanButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  loadError: { color: Colors.absent, fontSize: 12, lineHeight: 18 },
  retryLink: { color: Colors.primary, fontSize: 13, fontWeight: '700', marginTop: 5 },
  panel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 15,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',










































        
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  panelHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  chart: { height: 118, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 8 },
  chartColumn: { height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 7, width: 34 },
  barTrack: { height: 92, width: 22, borderRadius: 8, backgroundColor: Colors.absentBg, justifyContent: 'flex-end', overflow: 'hidden' },
  barPresent: { width: '100%', borderRadius: 8, backgroundColor: Colors.primary },
  chartLabel: { color: Colors.textTertiary, fontSize: 11, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  absenceDot: { backgroundColor: Colors.absentBg, marginLeft: 8 },
  weeklyAverage: { marginLeft: 'auto', color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  progressItem: { gap: 7 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  progressValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: Colors.surfaceMuted, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
  viewAll: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderDivider },
  firstStudentRow: { borderTopWidth: 0, paddingTop: 0 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textWhite, fontSize: 12, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  activeTag: { color: Colors.present, backgroundColor: Colors.presentBg, fontSize: 11, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  inactiveTag: { color: Colors.textSecondary, backgroundColor: Colors.surfaceMuted, fontSize: 11, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
