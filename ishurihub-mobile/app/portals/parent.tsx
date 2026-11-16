import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, ChevronDown, Home, Calendar, CreditCard, MessageSquare, User } from 'lucide-react-native';
import { MOCK_STUDENTS } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function ParentPortalScreen() {
  const [activePortalTab, setActivePortalTab] = useState('Home');
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);

  const child = MOCK_STUDENTS[selectedChildIndex];

  const childRecords = [
    { label: 'Canteen spending', value: '0 RWF' },
    { label: 'Library books', value: `${child.libraryBooksCount}` },
    { label: 'Discipline records', value: `${child.disciplineRecordsCount}` },
    { label: 'Health visits', value: `${child.healthVisitsCount}` },
  ];

  const tabs = [
    { label: 'Home', icon: Home },
    { label: 'Attendance', icon: Calendar },
    { label: 'Payments', icon: CreditCard },
    { label: 'Messages', icon: MessageSquare },
    { label: 'Profile', icon: User },
  ];

  const handleSwitchChild = () => {
    const next = (selectedChildIndex + 1) % 2;
    setSelectedChildIndex(next);
    Alert.alert('Child Switched', `Viewing profile for ${MOCK_STUDENTS[next].name}`);
  };

  const handleTopUp = () => {
    Alert.alert('Top Up Canteen Balance', `Opening Mobile Money top up prototype for ${child.name}.`);
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
          <Text style={styles.title}>Parent</Text>
        </View>

        {/* Linked Child Selector Card */}
        <TouchableOpacity
          style={styles.childCard}
          onPress={handleSwitchChild}
          activeOpacity={0.7}
          accessibilityLabel="Switch child"
        >
          <View style={[styles.avatar, { backgroundColor: child.avatarBg || Colors.studentAvatar }]}>
            <Text style={styles.avatarText}>{child.initials}</Text>
          </View>
          <View style={styles.childMeta}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childClass}>{child.class}</Text>
          </View>
          <ChevronDown size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Parent portal information is preview data; it is not linked to your family account yet.</PreviewNotice>
        {/* Today at school Status Card */}
        <View style={styles.todayCard}>
          <Text style={styles.todayCardLabel}>Today at school</Text>
          <Text style={styles.todayCardStatus}>No tap-in yet</Text>
        </View>

        {/* Canteen Balance Hero */}
        <View style={styles.balanceHero}>
          <View>
            <Text style={styles.balanceHeroLabel}>Canteen balance</Text>
            <Text style={styles.balanceHeroAmount}>{child.balance} RWF</Text>
          </View>
          <TouchableOpacity
            style={styles.topUpBtn}
            onPress={handleTopUp}
            activeOpacity={0.85}
          >
            <Text style={styles.topUpBtnText}>Top up</Text>
          </TouchableOpacity>
        </View>

        {/* Child Records Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{child.name.split(' ')[0]}’s records</Text>
          <View style={styles.recordsCard}>
            {childRecords.map((r, i) => {
              const isLast = i === childRecords.length - 1;
              return (
                <View
                  key={r.label}
                  style={[styles.recordRow, !isLast && styles.recordRowBorder]}
                >
                  <Text style={styles.recordLabel}>{r.label}</Text>
                  <Text style={styles.recordValue}>{r.value}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Parent Portal Bottom Navigation */}
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
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  childCard: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.studentAvatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  childMeta: {
    flex: 1,
    gap: 1,
  },
  childName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  childClass: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
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
  todayCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  todayCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  todayCardStatus: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  balanceHero: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  balanceHeroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryTextLight,
  },
  balanceHeroAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textWhite,
    marginTop: 2,
  },
  topUpBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUpBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recordRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  recordLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '700',
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
