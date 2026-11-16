import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchInput } from '../components/SearchInput';
import { VirtualTapModal } from '../components/VirtualTapModal';
import { Colors } from '../constants/theme';
import { ArrowLeft, Radio, ShieldAlert } from 'lucide-react-native';
import { MOCK_STUDENTS } from '../data/mockData';
import { PreviewNotice } from '../components/PreviewNotice';

export default function DisciplineScreen() {
  const [cardNumber, setCardNumber] = useState('');
  const [search, setSearch] = useState('');
  const [virtualTapOpen, setVirtualTapOpen] = useState(false);
  const [searchedStudent, setSearchedStudent] = useState<typeof MOCK_STUDENTS[0] | null>(null);

  const handleOpenRecord = () => {
    if (!cardNumber.trim()) {
      Alert.alert('Card Lookup', 'Please enter a student card number.');
      return;
    }
    const found = MOCK_STUDENTS.find(
      (s) => s.admissionNumber.toLowerCase() === cardNumber.trim().toLowerCase()
    ) || MOCK_STUDENTS[0];

    setSearchedStudent(found);
  };

  const handleVirtualTapStudent = (student: typeof MOCK_STUDENTS[0]) => {
    setSearchedStudent(student);
    setCardNumber(student.admissionNumber);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Back to More"
        >
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Discipline</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Discipline lookups and records are preview data; no student record is changed.</PreviewNotice>
        {/* NFC Not Available / Manual Lookup Card */}
        <View style={styles.card}>
          <View style={styles.nfcHeader}>
            <View style={styles.nfcIconBox}>
              <Radio size={22} color={Colors.primaryDark} strokeWidth={2.2} />
            </View>
            <View style={styles.nfcMeta}>
              <Text style={styles.nfcTitle}>NFC not available</Text>
              <Text style={styles.nfcSubtitle}>Enter the student’s card number.</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="Card number"
              placeholderTextColor={Colors.textSecondary}
              style={styles.monoInput}
            />
            <TouchableOpacity
              style={styles.openBtn}
              onPress={handleOpenRecord}
              activeOpacity={0.8}
            >
              <Text style={styles.openBtnText}>Open</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.virtualTapBtn}
            onPress={() => setVirtualTapOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.virtualTapText}>Use Virtual Tap</Text>
          </TouchableOpacity>

          {/* Searched Result Preview if opened */}
          {searchedStudent && (
            <View style={styles.resultBox}>
              <View style={[styles.avatar, { backgroundColor: searchedStudent.avatarBg || Colors.studentAvatar }]}>
                <Text style={styles.avatarText}>{searchedStudent.initials}</Text>
              </View>
              <View style={styles.resultMeta}>
                <Text style={styles.resultName}>{searchedStudent.name}</Text>
                <Text style={styles.resultDetails}>
                  {searchedStudent.class} · {searchedStudent.admissionNumber}
                </Text>
                <Text style={styles.cleanRecordText}>0 discipline records found. Student in good standing.</Text>
              </View>
            </View>
          )}
        </View>

        {/* All Records Section */}
        <View style={styles.recordsSection}>
          <View style={styles.recordsHeader}>
            <Text style={styles.sectionTitle}>All records</Text>
            <Text style={styles.recordsCount}>0 total</Text>
          </View>

          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search records"
          />

          <View style={styles.emptyCard}>
            <ShieldAlert size={42} color={Colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No discipline records</Text>
          </View>
        </View>
      </ScrollView>

      {/* Virtual Tap Simulation Modal */}
      <VirtualTapModal
        visible={virtualTapOpen}
        onClose={() => setVirtualTapOpen(false)}
        onTapStudent={handleVirtualTapStudent}
      />
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
    gap: 4,
    marginLeft: -8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
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
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  nfcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nfcIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcMeta: {
    flex: 1,
    gap: 2,
  },
  nfcTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nfcSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  monoInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 16,
  },
  openBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  virtualTapBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  virtualTapText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  resultBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  resultMeta: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  cleanRecordText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondaryGreen,
    marginTop: 2,
  },
  recordsSection: {
    gap: 10,
  },
  recordsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordsCount: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
