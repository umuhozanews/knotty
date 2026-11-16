import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Colors } from '../constants/theme';
import { QrCode, Edit3, UserMinus, Trash2, X } from 'lucide-react-native';
import { Worker } from '../types';

interface WorkerDetailSheetProps {
  worker: Worker | null;
  visible: boolean;
  onClose: () => void;
  onShowQR?: () => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
}

export const WorkerDetailSheet: React.FC<WorkerDetailSheetProps> = ({
  worker,
  visible,
  onClose,
  onShowQR,
  onEdit,
  onDeactivate,
  onDelete,
}) => {
  if (!worker) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.header}>
                <View style={styles.workerMeta}>
                  <View style={[styles.avatar, { backgroundColor: worker.avatarBg || Colors.tealAvatar }]}>
                    <Text style={styles.avatarText}>{worker.initials}</Text>
                  </View>
                  <View style={styles.nameBlock}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    <Text style={styles.workerRole}>{worker.role}</Text>
                    <Text style={styles.staffId}>{worker.staffId}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <X size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsList}>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={onShowQR} activeOpacity={0.7}>
                  <QrCode size={18} color={Colors.textPrimary} />
                  <Text style={styles.actionBtnSecondaryText}>Show QR code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnOutline} onPress={onEdit} activeOpacity={0.7}>
                  <Edit3 size={18} color={Colors.secondaryGreen} />
                  <Text style={styles.actionBtnOutlineText}>Edit details</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnSecondary} onPress={onDeactivate} activeOpacity={0.7}>
                  <UserMinus size={18} color={Colors.textSecondary} />
                  <Text style={[styles.actionBtnSecondaryText, { color: Colors.textSecondary }]}>Deactivate</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnDanger} onPress={onDelete} activeOpacity={0.7}>
                  <Trash2 size={18} color={Colors.absent} />
                  <Text style={styles.actionBtnDangerText}>Delete staff member</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 34,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  workerRole: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondaryGreen,
  },
  staffId: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsList: {
    gap: 8,
  },
  actionBtnSecondary: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionBtnOutline: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondaryGreen,
  },
  actionBtnDanger: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.absentBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.absent,
  },
});
