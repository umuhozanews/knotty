import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, BookUp2, BookDown, Home, Library, Clock, Receipt, User } from 'lucide-react-native';
import { SCHOOL_INFO } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function LibrarianPortalScreen() {
  const [activePortalTab, setActivePortalTab] = useState('Home');

  const stats = [
    { label: 'Total books', value: '0', color: Colors.secondaryGreen },
    { label: 'Active borrows', value: '0', color: Colors.textPrimary },
    { label: 'Overdue', value: '0', color: Colors.absent },
    { label: 'Pending fines', value: '0 RWF', color: Colors.absent },
  ];

  const handleLend = () => {
    Alert.alert('Lend a Book', 'Select or scan a student card to checkout a book.');
  };

  const handleReturn = () => {
    Alert.alert('Return a Book', 'Scan barcode or admission card for check-in.');
  };

  const tabs = [
    { label: 'Home', icon: Home },
    { label: 'Catalog', icon: Library },
    { label: 'Borrows', icon: Clock },
    { label: 'Fines', icon: Receipt },
    { label: 'Profile', icon: User },
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
        <View style={styles.headerTitleBlock}>
          <Text style={styles.schoolName}>{SCHOOL_INFO.name}</Text>
          <Text style={styles.portalTitle}>Librarian</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Library records and actions are preview data; lending changes are not saved.</PreviewNotice>
        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.lendBtn}
            onPress={handleLend}
            activeOpacity={0.85}
          >
            <BookUp2 size={18} color={Colors.textWhite} />
            <Text style={styles.lendBtnText}>Lend a book</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.returnBtn}
            onPress={handleReturn}
            activeOpacity={0.85}
          >
            <BookDown size={18} color={Colors.secondaryGreen} />
            <Text style={styles.returnBtnText}>Return a book</Text>
          </TouchableOpacity>
        </View>

        {/* 4 Library Stats */}
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statNumber, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Overdue Books Section */}
        <View style={styles.overdueCard}>
          <Text style={styles.cardTitle}>Overdue books</Text>
          <View style={styles.emptyState}>
            <Clock size={36} color={Colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No overdue books</Text>
          </View>
        </View>
      </ScrollView>

      {/* Librarian Portal Bottom Navigation */}
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
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  lendBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lendBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  returnBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  returnBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondaryGreen,
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
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overdueCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
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
