import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, ScanLine, AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';
import { SCHOOL_INFO, MOCK_STUDENTS } from '../../data/mockData';
import { VirtualTapModal } from '../../components/VirtualTapModal';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function GatePortalScreen() {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [scanned, setScanned] = useState(false);
  const [inCount, setInCount] = useState(0);
  const [outCount, setOutCount] = useState(0);
  const [virtualTapOpen, setVirtualTapOpen] = useState(false);

  const student = MOCK_STUDENTS[0]; // Tumukunde Josiane (Inactive)

  const insideCount = Math.max(0, inCount - outCount);
  const allowLabel = direction === 'in' ? 'Allow in' : 'Allow out';

  const handleStartScanner = () => {
    setVirtualTapOpen(true);
  };

  const handleVirtualTapStudent = (st: typeof MOCK_STUDENTS[0]) => {
    setScanned(true);
  };

  const handleAllow = () => {
    if (direction === 'in') {
      setInCount((c) => c + 1);
    } else {
      setOutCount((c) => c + 1);
    }
    setScanned(false);
    Alert.alert('Gate Access Granted', `${student.name} granted ${direction === 'in' ? 'entry' : 'exit'}.`);
  };

  const handleSendToOffice = () => {
    setScanned(false);
    Alert.alert('Sent to Office', `${student.name} flagged and redirected to administration office.`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.schoolName}>{SCHOOL_INFO.name}</Text>
            <Text style={styles.portalTitle}>School Gate</Text>
          </View>
        </View>

        {/* Direction Switcher: Coming in / Going out */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, direction === 'in' && styles.switchTabActive]}
            onPress={() => setDirection('in')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.switchTabText,
                direction === 'in' ? styles.switchTabTextActive : styles.switchTabTextInactive,
              ]}
            >
              Coming in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, direction === 'out' && styles.switchTabActive]}
            onPress={() => setDirection('out')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.switchTabText,
                direction === 'out' ? styles.switchTabTextActive : styles.switchTabTextInactive,
              ]}
            >
              Going out
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Gate scans are previews; no arrival or departure is recorded.</PreviewNotice>
        {scanned ? (
          /* Student Verification Result Card */
          <View style={styles.resultCard}>
            <View style={styles.studentMetaRow}>
              <View style={[styles.avatar, { backgroundColor: student.avatarBg || Colors.studentAvatar }]}>
                <Text style={styles.avatarText}>{student.initials}</Text>
              </View>
              <View style={styles.studentInfoCol}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentClass}>{student.class}</Text>
                <Text style={styles.studentId}>{student.admissionNumber}</Text>
              </View>
            </View>

            {/* Warning Message */}
            <View style={styles.warningBox}>
              <AlertTriangle size={18} color={Colors.absent} />
              <Text style={styles.warningText}>
                Inactive student. Check with the office.
              </Text>
            </View>

            {/* Gate Decisions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.allowBtn}
                onPress={handleAllow}
                activeOpacity={0.85}
              >
                <CheckCircle size={18} color={Colors.textWhite} />
                <Text style={styles.allowBtnText}>{allowLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.officeBtn}
                onPress={handleSendToOffice}
                activeOpacity={0.85}
              >
                <XCircle size={18} color={Colors.absent} />
                <Text style={styles.officeBtnText}>Send to office</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Scanner Hero Card */
          <View style={styles.scannerHero}>
            <View style={styles.scannerIconCircle}>
              <ScanLine size={36} color={Colors.surface} strokeWidth={2} />
            </View>
            <Text style={styles.scannerHeroTitle}>Scan student or staff card</Text>
            <TouchableOpacity
              style={styles.startScanBtn}
              onPress={handleStartScanner}
              activeOpacity={0.85}
            >
              <Text style={styles.startScanBtnText}>Start scanner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.virtualTapLink}
              onPress={() => setVirtualTapOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.virtualTapLinkText}>Use Virtual Tap</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gate Totals Today Grid */}
        <View style={styles.totalsGrid}>
          <View style={styles.totalCard}>
            <Text style={styles.totalNumber}>{inCount}</Text>
            <Text style={styles.totalLabel}>Came in</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalNumber}>{outCount}</Text>
            <Text style={styles.totalLabel}>Went out</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalNumber}>{insideCount}</Text>
            <Text style={styles.totalLabel}>Inside now</Text>
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
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTop: {
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
  headerTitleBlock: {
    gap: 1,
  },
  schoolName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  portalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
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
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTabActive: {
    backgroundColor: Colors.primary,
  },
  switchTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  switchTabTextActive: {
    color: Colors.textWhite,
  },
  switchTabTextInactive: {
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
  scannerHero: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  scannerIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  startScanBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startScanBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  virtualTapLink: {
    paddingVertical: 4,
  },
  virtualTapLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    textDecorationLine: 'underline',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.absent,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  studentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  studentInfoCol: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  studentClass: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  studentId: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  warningBox: {
    backgroundColor: Colors.absentBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.absent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: Colors.absent,
    fontWeight: '700',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  allowBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  allowBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  officeBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.absent,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  officeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.absent,
  },
  totalsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  totalCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  totalNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
