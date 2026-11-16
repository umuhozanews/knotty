import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { Radio, CheckCircle2, X } from 'lucide-react-native';
import { MOCK_STUDENTS } from '../data/mockData';

interface VirtualTapModalProps {
  visible: boolean;
  onClose: () => void;
  onTapStudent: (student: typeof MOCK_STUDENTS[0]) => void;
  title?: string;
  subtitle?: string;
}

export const VirtualTapModal: React.FC<VirtualTapModalProps> = ({
  visible,
  onClose,
  onTapStudent,
  title = 'Virtual NFC Tap Simulator',
  subtitle = 'Select a student card to simulate an instant NFC card tap.',
}) => {
  const [selectedStudent, setSelectedStudent] = useState(MOCK_STUDENTS[0]);
  const [tapped, setTapped] = useState(false);

  const handleSimulate = () => {
    setTapped(true);
    setTimeout(() => {
      setTapped(false);
      onTapStudent(selectedStudent);
      onClose();
    }, 600);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Radio size={24} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.studentList}>
            {MOCK_STUDENTS.slice(0, 3).map((st) => {
              const isSelected = selectedStudent.id === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.studentCard, isSelected && styles.studentCardActive]}
                  onPress={() => setSelectedStudent(st)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: st.avatarBg || Colors.studentAvatar }]}>
                    <Text style={styles.avatarText}>{st.initials}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{st.name}</Text>
                    <Text style={styles.studentCardCode}>{st.admissionNumber}</Text>
                  </View>
                  {isSelected && (
                    <CheckCircle2 size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.tapButton, tapped && styles.tapButtonSuccess]}
            onPress={handleSimulate}
            activeOpacity={0.8}
          >
            <Radio size={20} color={Colors.textWhite} />
            <Text style={styles.tapButtonText}>
              {tapped ? 'Tapping Card...' : `Tap ${selectedStudent.name.split(' ')[0]}'s Card`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  studentList: {
    gap: 8,
    marginBottom: 16,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  studentCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 13,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  studentCardCode: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  tapButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tapButtonSuccess: {
    backgroundColor: Colors.primaryDark,
  },
  tapButtonText: {
    color: Colors.textWhite,
    fontSize: 15,
    fontWeight: '700',
  },
});
