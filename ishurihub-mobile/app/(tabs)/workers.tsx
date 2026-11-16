import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterPills } from '../../components/FilterPills';
import { WorkerDetailSheet } from '../../components/WorkerDetailSheet';
import { Colors } from '../../constants/theme';
import { UserPlus } from 'lucide-react-native';
import { MOCK_WORKERS } from '../../data/mockData';
import { Worker } from '../../types';
import { PreviewNotice } from '../../components/PreviewNotice';

export default function WorkersScreen() {
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const roleFilters = [
    { id: 'all', label: 'All', count: MOCK_WORKERS.length },
    { id: 'teacher', label: 'Teacher', count: MOCK_WORKERS.filter((w) => w.roleId === 'teacher').length },
    { id: 'cantinier', label: 'Cantinier', count: MOCK_WORKERS.filter((w) => w.roleId === 'cantinier').length },
    { id: 'bursar', label: 'Bursar', count: MOCK_WORKERS.filter((w) => w.roleId === 'bursar').length },
    { id: 'nurse', label: 'School Nurse', count: MOCK_WORKERS.filter((w) => w.roleId === 'nurse').length },
    { id: 'discipline', label: 'Discipline Master', count: 0 },
    { id: 'librarian', label: 'Librarian', count: 0 },
    { id: 'administrator', label: 'Administrator', count: 0 },
  ];

  const filteredWorkers =
    selectedRole === 'all'
      ? MOCK_WORKERS
      : MOCK_WORKERS.filter((w) => w.roleId === selectedRole);

  const handleAddWorker = () => {
    Alert.alert('Add Staff', 'Opening new staff registration modal.');
  };

  const handleShowQR = () => {
    Alert.alert('Staff QR Code', `Displaying identity badge QR code for ${selectedWorker?.name} (${selectedWorker?.staffId}).`);
  };

  const handleEditDetails = () => {
    Alert.alert('Edit Staff', `Editing staff profile for ${selectedWorker?.name}.`);
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate Staff', `Are you sure you want to deactivate ${selectedWorker?.name}?`);
  };

  const handleDelete = () => {
    Alert.alert('Delete Staff', `Staff member ${selectedWorker?.name} deletion cancelled (demo mode).`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Staff</Text>
          <Text style={styles.activeCount}>{MOCK_WORKERS.length} active</Text>
        </View>

        <FilterPills
          items={roleFilters}
          selectedId={selectedRole}
          onSelect={setSelectedRole}
        />
      </View>

      {/* Staff List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PreviewNotice>Staff records and actions are preview data; changes are not saved.</PreviewNotice>
        {filteredWorkers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No staff in this role yet.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredWorkers.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.workerCard}
                onPress={() => setSelectedWorker(w)}
                activeOpacity={0.7}
                accessibilityLabel={`Open actions for ${w.name}`}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: w.avatarBg || Colors.tealAvatar },
                  ]}
                >
                  <Text style={styles.avatarText}>{w.initials}</Text>
                </View>

                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{w.name}</Text>
                  <Text style={styles.workerRole}>{w.role}</Text>
                  <Text style={styles.workerDept}>{w.department}</Text>
                </View>

                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{w.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Staff Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddWorker}
        activeOpacity={0.85}
        accessibilityLabel="Add staff member"
      >
        <UserPlus size={18} color={Colors.textWhite} />
        <Text style={styles.fabText}>Add staff</Text>
      </TouchableOpacity>

      {/* Staff Detail Bottom Sheet */}
      <WorkerDetailSheet
        worker={selectedWorker}
        visible={Boolean(selectedWorker)}
        onClose={() => setSelectedWorker(null)}
        onShowQR={handleShowQR}
        onEdit={handleEditDetails}
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
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
  activeCount: {
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
  },
  listContainer: {
    gap: 10,
  },
  workerCard: {
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
  workerInfo: {
    flex: 1,
    gap: 2,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  workerRole: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondaryGreen,
  },
  workerDept: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.presentBg,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
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
