import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';

interface AttendanceSummaryProps {
  scannedCount?: number | null;
  presentCount: number | null;
  absentCount: number | null;
  lateCount: number | null;
  excusedCount: number | null;
  title?: string;
  loading?: boolean;
}

export const AttendanceSummary: React.FC<AttendanceSummaryProps> = ({
  scannedCount = 0,
  presentCount = 0,
  absentCount = 0,
  lateCount = 0,
  excusedCount = 0,
  title = "Today’s summary",
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.scannedCount}>{loading ? 'Loading…' : `${scannedCount ?? '—'} scanned`}</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '—' : presentCount ?? '—'}</Text>
          <Text style={[styles.statLabel, { color: Colors.present }]}>Present</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '—' : absentCount ?? '—'}</Text>
          <Text style={[styles.statLabel, { color: Colors.absent }]}>Absent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '—' : lateCount ?? '—'}</Text>
          <Text style={[styles.statLabel, { color: Colors.late }]}>Late</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{loading ? '—' : excusedCount ?? '—'}</Text>
          <Text style={[styles.statLabel, { color: Colors.excused }]}>Excused</Text>
        </View>
      </View>
    </View>
  );
};

interface SchoolTotalsProps {
  studentsCount: number | null;
  workersCount: number | null;
  onPressStudents?: () => void;
  onPressWorkers?: () => void;
}

export const SchoolTotals: React.FC<SchoolTotalsProps> = ({
  studentsCount = 2,
  workersCount = 2,
  onPressStudents,
  onPressWorkers,
}) => {
  return (
    <View style={styles.totalsGrid}>
      <TouchableOpacity
        style={styles.totalCard}
        onPress={onPressStudents}
        activeOpacity={0.7}
      >
        <Text style={styles.totalNumber}>{studentsCount ?? '—'}</Text>
        <Text style={styles.totalLabel}>Students</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.totalCard}
        onPress={onPressWorkers}
        activeOpacity={0.7}
      >
        <Text style={styles.totalNumber}>{workersCount ?? '—'}</Text>
        <Text style={styles.totalLabel}>Staff</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scannedCount: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  grid: {
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
});
