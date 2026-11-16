import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, PlusCircle, ShieldAlert, Home, FileText, Users, BarChart3, User } from 'lucide-react-native';
import { SCHOOL_INFO } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function DisciplinePortalScreen() {
  const [activePortalTab, setActivePortalTab] = useState('Home');
  const [cardNumber, setCardNumber] = useState('');

  const tabs = [
    { label: 'Home', icon: Home },
    { label: 'Records', icon: FileText },
    { label: 'Students', icon: Users },
    { label: 'Reports', icon: BarChart3 },
    { label: 'Profile', icon: User },
  ];

  const handleAddRecord = () => {
    Alert.alert('New Discipline Record', 'Opening incident record creation form.');
  };

  const handleOpen = () => {
    if (!cardNumber.trim()) {
      Alert.alert('Student Card', 'Please enter a student card number.');
      return;
    }
    Alert.alert('Discipline Record', `Opening discipline profile for student with card ${cardNumber.trim()}.`);
  };

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
          <Text style={styles.portalTitle}>Discipline Office</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Discipline records are preview data and are not saved.</PreviewNotice>
        {/* Find / Add Student Record Section */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.addRecordBtn}
            onPress={handleAddRecord}
            activeOpacity={0.85}
          >
            <PlusCircle size={20} color={Colors.textWhite} />
            <Text style={styles.addRecordBtnText}>Add discipline record</Text>
          </TouchableOpacity>

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
              onPress={handleOpen}
              activeOpacity={0.7}
            >
              <Text style={styles.openBtnText}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Discipline Totals Grid */}
        <View style={styles.totalsGrid}>
          <View style={styles.totalCard}>
            <Text style={styles.totalNumber}>0</Text>
            <Text style={styles.totalLabel}>Records today</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalNumber}>0</Text>
            <Text style={styles.totalLabel}>All records</Text>
          </View>
        </View>

        {/* Recent Records Section */}
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent records</Text>
          <View style={styles.emptyContainer}>
            <ShieldAlert size={36} color={Colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No discipline records</Text>
          </View>
        </View>
      </ScrollView>

      {/* Discipline Portal Bottom Navigation */}
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
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  addRecordBtn: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addRecordBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
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
    fontFamily: 'monospace',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  openBtn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondaryGreen,
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
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyContainer: {
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
