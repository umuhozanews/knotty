import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, Switch } from 'react-native';
import { Colors } from '../constants/theme';
import { X } from 'lucide-react-native';

interface AttendanceSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const AttendanceSettingsSheet: React.FC<AttendanceSettingsSheetProps> = ({
  visible,
  onClose,
}) => {
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [autoTapIn, setAutoTapIn] = useState(true);
  const [vibration, setVibration] = useState(true);

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
                <Text style={styles.sheetTitle}>Attendance settings</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <X size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsList}>
                <View style={styles.optionRow}>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Audio feedback</Text>
                    <Text style={styles.optionDesc}>Beep on valid card scan</Text>
                  </View>
                  <Switch
                    value={audioFeedback}
                    onValueChange={setAudioFeedback}
                    trackColor={{ false: Colors.borderInput, true: Colors.primary }}
                    thumbColor={Colors.surface}
                  />
                </View>

                <View style={styles.optionRow}>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Auto tap-in mode</Text>
                    <Text style={styles.optionDesc}>Automatically detect direction</Text>
                  </View>
                  <Switch
                    value={autoTapIn}
                    onValueChange={setAutoTapIn}
                    trackColor={{ false: Colors.borderInput, true: Colors.primary }}
                    thumbColor={Colors.surface}
                  />
                </View>

                <View style={styles.optionRow}>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Haptic vibration</Text>
                    <Text style={styles.optionDesc}>Vibrate on successful tap</Text>
                  </View>
                  <Switch
                    value={vibration}
                    onValueChange={setVibration}
                    trackColor={{ false: Colors.borderInput, true: Colors.primary }}
                    thumbColor={Colors.surface}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
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
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    gap: 10,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
    paddingRight: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  optionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  doneBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
