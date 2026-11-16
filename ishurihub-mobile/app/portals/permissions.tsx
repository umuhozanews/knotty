import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { PreviewNotice } from '../../components/PreviewNotice';
import { ArrowLeft } from 'lucide-react-native';
import {
  PERMISSION_MATRIX_ROLES,
  PERMISSION_MATRIX_ROWS,
  PERMISSION_LEGEND,
} from '../../data/mockData';
import { PermissionLevel } from '../../types';

export default function PermissionMatrixScreen() {
  const getLevelStyle = (code: PermissionLevel) => {
    switch (code) {
      case 'M':
        return { label: 'Manage', bg: Colors.matrixManage, fg: Colors.matrixManageFg };
      case 'V':
        return { label: 'View', bg: Colors.matrixView, fg: Colors.matrixViewFg };
      case 'O':
        return { label: 'Own', bg: Colors.matrixOwn, fg: Colors.matrixOwnFg };
      case 'S':
        return { label: 'Totals', bg: Colors.matrixTotals, fg: Colors.matrixTotalsFg };
      case 'N':
      default:
        return { label: '—', bg: Colors.matrixNone, fg: Colors.matrixNoneFg };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions Matrix</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>This permission matrix is a design preview. The backend enforces access independently.</PreviewNotice>
        {/* Title and Subtitle */}
        <View style={styles.titleSection}>
          <Text style={styles.matrixTitle}>Who can see what</Text>
          <Text style={styles.matrixSubtitle}>
            One login page. IshuriHUB opens the right portal for each person.
          </Text>
        </View>

        {/* Legend */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.legendContainer}
        >
          {PERMISSION_LEGEND.map((l) => (
            <View
              key={l.label}
              style={[styles.legendPill, { backgroundColor: l.bg }]}
            >
              <Text style={[styles.legendLabel, { color: l.fg }]}>{l.label}</Text>
              <Text style={[styles.legendHelp, { color: l.fg }]}>{l.help}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Permission Table (Horizontal Scrollable for mobile screens) */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Table Header Row */}
              <View style={styles.tableHeaderRow}>
                <View style={styles.sectionHeaderCell}>
                  <Text style={styles.tableHeaderSectionText}>Section</Text>
                </View>
                {PERMISSION_MATRIX_ROLES.map((role) => (
                  <View key={role} style={styles.roleHeaderCell}>
                    <Text style={styles.roleHeaderText} numberOfLines={2}>
                      {role}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Table Body Rows */}
              {PERMISSION_MATRIX_ROWS.map((row, idx) => {
                const isLast = idx === PERMISSION_MATRIX_ROWS.length - 1;
                return (
                  <View
                    key={row.section}
                    style={[styles.tableBodyRow, !isLast && styles.tableRowBorder]}
                  >
                    <View style={styles.sectionCell}>
                      <Text style={styles.sectionNameText}>{row.section}</Text>
                    </View>
                    {row.cells.map((cell, colIdx) => {
                      const level = getLevelStyle(cell);
                      return (
                        <View key={colIdx} style={styles.cellWrapper}>
                          <View
                            style={[
                              styles.levelBadge,
                              { backgroundColor: level.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.levelBadgeText,
                                { color: level.fg },
                              ]}
                            >
                              {level.label}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
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
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  titleSection: {
    gap: 4,
  },
  matrixTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  matrixSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  legendPill: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 2,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  legendHelp: {
    fontSize: 11,
    fontWeight: '500',
  },
  tableCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: Colors.textPrimary,
    paddingHorizontal: 8,
  },
  sectionHeaderCell: {
    width: 140,
    paddingVertical: 12,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  tableHeaderSectionText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  roleHeaderCell: {
    width: 90,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  sectionCell: {
    width: 140,
    paddingVertical: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  sectionNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cellWrapper: {
    width: 90,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
