import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

export interface FilterItem {
  id: string;
  label: string;
  count?: number;
}

interface FilterPillsProps {
  items: FilterItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const FilterPills: React.FC<FilterPillsProps> = ({
  items,
  selectedId,
  onSelect,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[
              styles.pill,
              isSelected ? styles.pillSelected : styles.pillUnselected,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pillText,
                isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
              ]}
            >
              {item.label}
              {typeof item.count === 'number' ? ` ${item.count}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    marginHorizontal: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pillUnselected: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderInput,
  },
  pillText: {
    fontSize: 14,
  },
  pillTextSelected: {
    fontWeight: '700',
    color: Colors.textWhite,
  },
  pillTextUnselected: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
