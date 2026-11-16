import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchInput } from '../components/SearchInput';
import { FilterPills } from '../components/FilterPills';
import { Colors } from '../constants/theme';
import { ArrowLeft, BookOpen, Plus, BookUp2, BookDown } from 'lucide-react-native';
import { PreviewNotice } from '../components/PreviewNotice';

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog'>('overview');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');

  const filterItems = [
    { id: 'all', label: 'All (0)' },
    { id: 'overdue', label: 'Overdue (0)' },
  ];

  const handleAddBook = () => {
    Alert.alert('Add Book', 'Opening catalog book entry form.');
  };

  const handleLendBook = () => {
    Alert.alert('Lend a Book', 'Scan student card or select a book to lend.');
  };

  const handleReturnBook = () => {
    Alert.alert('Return Book', 'Scan book barcode to register return.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel="Back to More"
          >
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Library</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'overview' && styles.switchTabActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchTabText, activeTab === 'overview' && styles.switchTabTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'catalog' && styles.switchTabActive]}
            onPress={() => setActiveTab('catalog')}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchTabText, activeTab === 'catalog' && styles.switchTabTextActive]}>
              Book catalog
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Library records and actions are preview data; lending changes are not saved.</PreviewNotice>
        {activeTab === 'overview' ? (
          <>
            {/* 4 Stat Cards in 2x2 Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: Colors.secondaryGreen }]}>0</Text>
                <Text style={styles.statLabel}>Total books</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Active borrows</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: Colors.absent }]}>0</Text>
                <Text style={styles.statLabel}>Overdue</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: Colors.absent }]}>0 RWF</Text>
                <Text style={styles.statLabel}>Pending fines</Text>
              </View>
            </View>

            {/* Students Holding Books Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Students holding books</Text>
              <FilterPills
                items={filterItems}
                selectedId={filter}
                onSelect={(id) => setFilter(id as 'all' | 'overdue')}
              />
            </View>

            {/* Empty State */}
            <View style={styles.emptyCard}>
              <BookOpen size={40} color={Colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {filter === 'all' ? 'No active borrows' : 'No overdue books'}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Catalog Search & Empty State */}
            <SearchInput
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              placeholder="Search catalog by title, author, or ISBN"
            />

            <View style={styles.emptyCatalogCard}>
              <Text style={styles.emptyCatalogText}>No books in the catalog yet.</Text>
              <TouchableOpacity
                style={styles.addBookBtn}
                onPress={handleAddBook}
                activeOpacity={0.8}
              >
                <Plus size={18} color={Colors.textWhite} />
                <Text style={styles.addBookBtnText}>Add book</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.lendBtn}
          onPress={handleLendBook}
          activeOpacity={0.85}
        >
          <BookUp2 size={20} color={Colors.textWhite} />
          <Text style={styles.lendBtnText}>Lend a book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.returnBtn}
          onPress={handleReturnBook}
          activeOpacity={0.85}
        >
          <BookDown size={20} color={Colors.secondaryGreen} />
          <Text style={styles.returnBtnText}>Return</Text>
        </TouchableOpacity>
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
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
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
    paddingBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sectionHeader: {
    gap: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  emptyCatalogCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyCatalogText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  addBookBtn: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    gap: 8,
  },
  lendBtn: {
    flex: 2,
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
    gap: 6,
  },
  returnBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
});
