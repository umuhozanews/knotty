import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttendanceSummary } from '../../components/StatCard';
import { PreviewNotice } from '../../components/PreviewNotice';
import { AttendanceSettingsSheet } from '../../components/AttendanceSettingsSheet';
import { VirtualTapModal } from '../../components/VirtualTapModal';
import { Colors } from '../../constants/theme';
import { SlidersHorizontal, ScanLine, FileDown, Check } from 'lucide-react-native';
import { MOCK_STUDENTS } from '../../data/mockData';
import { AttendanceStatus } from '../../types';

export default function AttendanceScreen() {
  const [activeTab, setActiveTab] = useState<'tap' | 'bulk'>('tap');
  const [scanMode, setScanMode] = useState<'auto' | 'in' | 'out'>('auto');
  const [manualCard, setManualCard] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [virtualTapOpen, setVirtualTapOpen] = useState(false);

  // Attendance states for sample students
  const [scannedCount, setScannedCount] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [excusedCount, setExcusedCount] = useState(0);

  // Bulk mark status for Tumukunde Josiane
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const modeHelp = {
    auto: 'Checks in arriving students and checks out students already inside.',
    in: 'Every scan records a tap-in.',
    out: 'Every scan records a tap-out.',
  };

  const handleStartScanner = () => {
    setVirtualTapOpen(true);
  };

  const handleLookup = () => {
    if (!manualCard.trim()) {
      Alert.alert('Manual Lookup', 'Please enter a card number to lookup.');
      return;
    }
    setScannedCount((c) => c + 1);
    setPresentCount((c) => c + 1);
    Alert.alert('Card Found', `Card ${manualCard.trim()} identified for Tumukunde Josiane. Marked Present.`);
    setManualCard('');
  };

  const handleVirtualTapStudent = (student: typeof MOCK_STUDENTS[0]) => {
    setScannedCount((c) => c + 1);
    if (scanMode === 'out') {
      Alert.alert('Virtual Tap-Out', `Tap-out recorded for ${student.name} (${student.admissionNumber})`);
    } else {
      setPresentCount((c) => c + 1);
      Alert.alert('Virtual Tap-In', `Tap-in recorded for ${student.name} (${student.admissionNumber}). Status: Present.`);
    }
  };

  const handleSaveBulk = () => {
    setSaveSuccess(true);
    if (bulkStatus === 'present') setPresentCount((c) => c + 1);
    else if (bulkStatus === 'absent') setAbsentCount((c) => c + 1);
    else if (bulkStatus === 'late') setLateCount((c) => c + 1);
    else if (bulkStatus === 'excused') setExcusedCount((c) => c + 1);

    setTimeout(() => {
      setSaveSuccess(false);
      Alert.alert('Attendance Saved', `Roster attendance for Senior 1 · Class A updated.`);
    }, 500);
  };

  const handleDownloadPdf = () => {
    Alert.alert('Download Attendance', 'Preparing printable daily attendance PDF for Wed, 4 Nov.');
  };

  const markOptions: { id: AttendanceStatus; label: string; color: string }[] = [
    { id: 'present', label: 'Present', color: Colors.present },
    { id: 'absent', label: 'Absent', color: Colors.absent },
    { id: 'late', label: 'Late', color: Colors.late },
    { id: 'excused', label: 'Excused', color: Colors.excused },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>Wed, 4 Nov · All classes</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setSettingsOpen(true)}
            activeOpacity={0.7}
            accessibilityLabel="Scan settings"
          >
            <SlidersHorizontal size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: Tap card / Bulk mark */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'tap' && styles.switchTabActive]}
            onPress={() => setActiveTab('tap')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchTabText, activeTab === 'tap' && styles.switchTabTextActive]}>
              Tap card
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'bulk' && styles.switchTabActive]}
            onPress={() => setActiveTab('bulk')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchTabText, activeTab === 'bulk' && styles.switchTabTextActive]}>
              Bulk mark
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>This scanner and roster are previews. Check-ins made here are not saved to school attendance.</PreviewNotice>
        {activeTab === 'tap' ? (
          <>
            {/* Scan section */}
            <View style={styles.card}>
              <View style={styles.modeGrid}>
                {(['auto', 'in', 'out'] as const).map((m) => {
                  const on = scanMode === m;
                  const labels = { auto: 'Auto', in: 'Tap in', out: 'Tap out' };
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.modeButton,
                        on ? styles.modeButtonActive : styles.modeButtonInactive,
                      ]}
                      onPress={() => setScanMode(m)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.modeButtonText,
                          on ? styles.modeButtonTextActive : styles.modeButtonTextInactive,
                        ]}
                      >
                        {labels[m]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modeHelpText}>{modeHelp[scanMode]}</Text>

              <TouchableOpacity
                style={styles.startScannerBtn}
                onPress={handleStartScanner}
                activeOpacity={0.85}
              >
                <ScanLine size={22} color={Colors.textWhite} strokeWidth={2.2} />
                <Text style={styles.startScannerText}>Start scanner</Text>
              </TouchableOpacity>
            </View>

            {/* Manual Card section */}
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Or enter card number</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={manualCard}
                  onChangeText={setManualCard}
                  placeholder="KNT-XXX-2026-00001"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.monoInput}
                />
                <TouchableOpacity
                  style={styles.lookupBtn}
                  onPress={handleLookup}
                  activeOpacity={0.7}
                >
                  <Text style={styles.lookupBtnText}>Lookup</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setVirtualTapOpen(true)}
                activeOpacity={0.7}
                style={styles.virtualTapBtn}
              >
                <Text style={styles.virtualTapText}>Use Virtual Tap</Text>
              </TouchableOpacity>
            </View>

            {/* Today's Summary */}
            <AttendanceSummary
              scannedCount={scannedCount}
              presentCount={presentCount}
              absentCount={absentCount}
              lateCount={lateCount}
              excusedCount={excusedCount}
            />

            {/* Download PDF Button */}
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={handleDownloadPdf}
              activeOpacity={0.7}
            >
              <FileDown size={18} color={Colors.primary} />
              <Text style={styles.pdfBtnText}>Download attendance PDF</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Bulk Mark View */}
            <View style={styles.card}>
              <Text style={styles.classPickerLabel}>Class: Senior 1 · Class A</Text>

              <View style={styles.rosterCard}>
                <View style={[styles.avatar, { backgroundColor: Colors.studentAvatar }]}>
                  <Text style={styles.avatarText}>TJ</Text>
                </View>
                <View style={styles.rosterInfo}>
                  <Text style={styles.rosterName}>Tumukunde Josiane</Text>
                  <Text style={styles.rosterId}>ADM-2026-RLIB7</Text>
                </View>
              </View>

              {/* Status Selector */}
              <View style={styles.marksGrid}>
                {markOptions.map((opt) => {
                  const on = bulkStatus === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.markBtn,
                        on
                          ? { backgroundColor: opt.color, borderColor: opt.color }
                          : { backgroundColor: Colors.surface, borderColor: Colors.borderInput },
                      ]}
                      onPress={() => setBulkStatus(opt.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.markBtnText,
                          on ? { color: Colors.textWhite } : { color: Colors.textSecondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveBulk}
                activeOpacity={0.85}
              >
                {saveSuccess ? (
                  <Check size={20} color={Colors.textWhite} />
                ) : null}
                <Text style={styles.saveBtnText}>Save attendance</Text>
              </TouchableOpacity>
            </View>

            {/* Additional Student in Class */}
            <View style={styles.card}>
              <View style={styles.rosterCard}>
                <View style={[styles.avatar, { backgroundColor: Colors.tealAvatar }]}>
                  <Text style={styles.avatarText}>MD</Text>
                </View>
                <View style={styles.rosterInfo}>
                  <Text style={styles.rosterName}>Mugisha David</Text>
                  <Text style={styles.rosterId}>ADM-2026-RLIB8</Text>
                </View>
                <View style={styles.presentBadge}>
                  <Text style={styles.presentBadgeText}>Present</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Attendance Settings Sheet */}
      <AttendanceSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

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
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSwitcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    gap: 4,
  },
  switchTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTabActive: {
    backgroundColor: Colors.surface,
  },
  switchTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  switchTabTextActive: {
    color: Colors.textPrimary,
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
  modeGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modeButtonActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  modeButtonInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderInput,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: Colors.primaryDark,
  },
  modeButtonTextInactive: {
    color: Colors.textSecondary,
  },
  modeHelpText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  startScannerBtn: {
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startScannerText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
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
    fontSize: 15,
    letterSpacing: -0.5,
  },
  lookupBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  virtualTapBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  virtualTapText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  pdfBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pdfBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  classPickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '700',
  },
  rosterInfo: {
    flex: 1,
    gap: 2,
  },
  rosterName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rosterId: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  marksGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  markBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  presentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.presentBg,
  },
  presentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.present,
  },
});
