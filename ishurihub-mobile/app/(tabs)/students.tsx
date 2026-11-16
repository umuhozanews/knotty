import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchInput } from '../../components/SearchInput';
import { FilterPills } from '../../components/FilterPills';
import { Colors } from '../../constants/theme';
import { ApiStudent, getStudents } from '../../lib/api';
import { studentAvatarColor, studentClass, studentInitials, studentName } from '../../lib/studentDisplay';
import { useAuth } from '../../context/AuthContext';

export default function StudentsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      if (!user?.school_id) {
        setError('Your account is not connected to an active school.');
        setLoading(false);
        return;
      }
      getStudents(user.school_id, search, 100).then((result) => {
        if (!active) return;
        setStudents(result.students);
        setTotal(result.total);
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load students.');
      }).finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [search, reloadKey, user?.school_id]);

  const classOptions = useMemo(() => {
    const names = Array.from(new Set(students.map(studentClass).filter((name) => name !== 'Class not assigned')));
    return [{ id: 'all', label: 'All', count: total }, ...names.map((name) => ({
      id: name,
      label: name,
      count: students.filter((student) => studentClass(student) === name).length,
    }))];
  }, [students, total]);

  const filteredStudents = selectedClass === 'all'
    ? students
    : students.filter((student) => studentClass(student) === selectedClass);

  const countLabel = selectedClass === 'all'
    ? `${total} total students`
    : `${filteredStudents.length} loaded in ${selectedClass}`;

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Students</Text>
          <Text style={styles.totalCount}>{loading ? 'Loading…' : `${total} total`}</Text>
        </View>
        <TouchableOpacity style={styles.cardsButton} onPress={() => router.push('/cards')} activeOpacity={0.8}>
          <Text style={styles.cardsButtonText}>Manage NFC cards</Text>
        </TouchableOpacity>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by student name"
        />

        <FilterPills
          items={classOptions}
          selectedId={selectedClass}
          onSelect={setSelectedClass}
        />
      </View>

      {/* Student List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.classCountText}>{countLabel}</Text>

        {loading && students.length === 0 ? (
          <View style={styles.stateBox}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading students…</Text></View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : filteredStudents.length === 0 ? (
          <View style={styles.stateBox}><Text style={styles.stateText}>No students found.</Text></View>
        ) : (
        <View style={styles.listContainer}>
          {filteredStudents.map((st) => (
            <TouchableOpacity
              key={st.id}
              style={styles.studentCard}
              onPress={() => router.push(`/student/${st.id}`)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: studentAvatarColor(st) },
                ]}
              >
                <Text style={styles.avatarText}>{studentInitials(st)}</Text>
              </View>

              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{studentName(st)}</Text>
                <Text style={styles.admissionNumber}>{st.student_code}</Text>
                <Text style={styles.className}>{studentClass(st)}</Text>
              </View>

              <View style={styles.statusCol}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        st.is_active ? Colors.secondaryGreen : Colors.absent,
                    },
                  ]}
                >
                  {st.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  cardsButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, backgroundColor: Colors.primary },
  cardsButtonText: { color: Colors.textWhite, fontSize: 13, fontWeight: '700' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  totalCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 10,
  },
  classCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  className: { fontSize: 11, color: Colors.textTertiary },
  stateBox: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  stateText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  errorText: { fontSize: 14, color: Colors.absent, textAlign: 'center', lineHeight: 20 },
  retryText: { color: Colors.primary, fontSize: 14, fontWeight: '700', padding: 8 },
  listContainer: {
    gap: 10,
  },
  studentCard: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
    gap: 3,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  admissionNumber: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  fabText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '700',
  },
});
