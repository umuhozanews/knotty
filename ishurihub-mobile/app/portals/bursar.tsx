import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/theme';
import { ArrowLeft, Coins, Home, CreditCard, Receipt, BarChart3, User, ShoppingCart } from 'lucide-react-native';
import { SCHOOL_INFO } from '../../data/mockData';
import { PreviewNotice } from '../../components/PreviewNotice';
import { useAuth } from '../../context/AuthContext';
import { formatRwf, getCanteenSalesSummary, listCanteenTransactions, type CanteenTransaction } from '../../lib/canteen';

export default function BursarPortalScreen() {
  const { user } = useAuth();
  const [activePortalTab, setActivePortalTab] = useState('Home');
  const [collectedToday, setCollectedToday] = useState(0);
  const [canteenSales, setCanteenSales] = useState(0);
  const [canteenCount, setCanteenCount] = useState(0);
  const [recentTx, setRecentTx] = useState<CanteenTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCanteenData = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const [summary, txList] = await Promise.all([
        getCanteenSalesSummary(user.school_id),
        listCanteenTransactions(user.school_id, 5, 0),
      ]);
      setCanteenSales(summary.total_sales ?? 0);
      setCanteenCount(summary.transaction_count ?? 0);
      setRecentTx(txList);
    } catch {
      // silent — keep zeros on error
    } finally {
      setLoading(false);
    }
  }, [user?.school_id]);

  useEffect(() => { loadCanteenData(); }, [loadCanteenData]);

  const schoolMoneyRows = [
    { label: 'School fees owing', value: '0 RWF' },
    { label: `Canteen sales today (${canteenCount})`, value: loading ? '...' : formatRwf(canteenSales) },
    { label: 'Pending library fines', value: '0 RWF' },
  ];

  const tabs = [
    { label: 'Home', icon: Home },
    { label: 'Payments', icon: CreditCard },
    { label: 'Fees', icon: Receipt },
    { label: 'Reports', icon: BarChart3 },
    { label: 'Profile', icon: User },
  ];

  const handleRecordPayment = () => {
    Alert.alert(
      'Record School Fee Payment',
      'Select student and enter amount in RWF.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record 25,000 RWF',
          onPress: () => {
            setCollectedToday((c) => c + 25000);
            Alert.alert('Payment Recorded', 'Receipt #REC-2026-0041 issued.');
          },
        },
      ]
    );
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
          <Text style={styles.portalTitle}>Bursar</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Finance figures and actions are preview data; payments are not processed.</PreviewNotice>
        {/* Collected Today Hero Banner */}
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroLabel}>Collected today</Text>
            <Text style={styles.heroAmount}>{collectedToday} RWF</Text>
          </View>
          <TouchableOpacity
            style={styles.recordBtn}
            onPress={handleRecordPayment}
            activeOpacity={0.85}
          >
            <Text style={styles.recordBtnText}>Record payment</Text>
          </TouchableOpacity>
        </View>

        {/* School Money Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School money</Text>
          <View style={styles.breakdownCard}>
            {schoolMoneyRows.map((r, i) => {
              const isLast = i === schoolMoneyRows.length - 1;
              return (
                <View
                  key={r.label}
                  style={[styles.breakdownRow, !isLast && styles.breakdownRowBorder]}
                >
                  <Text style={styles.breakdownLabel}>{r.label}</Text>
                  <Text style={styles.breakdownValue}>{r.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Canteen quick-access */}
        <TouchableOpacity style={styles.canteenBtn} onPress={() => router.push('/canteen')} activeOpacity={0.85}>
          <ShoppingCart size={20} color={Colors.textWhite} />
          <Text style={styles.canteenBtnText}>Open Canteen POS</Text>
        </TouchableOpacity>

        {/* Recent canteen transactions */}
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent canteen sales</Text>
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator color={Colors.primaryDark} />
            </View>
          ) : recentTx.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Coins size={36} color={Colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>No sales today</Text>
            </View>
          ) : (
            recentTx.map((tx, i) => {
              const isLast = i === recentTx.length - 1;
              return (
                <View key={tx.id} style={[styles.txRow, !isLast && styles.txRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txName}>{tx.legal_name || 'Unknown student'}</Text>
                    <Text style={styles.txTime}>{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.txAmount}>{formatRwf(tx.total_amount)}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bursar Portal Bottom Navigation */}
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
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryTextLight,
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textWhite,
    marginTop: 2,
  },
  recordBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnText: {
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
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  breakdownRow: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
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
  canteenBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  canteenBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  txRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDivider,
  },
  txName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  txTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
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
