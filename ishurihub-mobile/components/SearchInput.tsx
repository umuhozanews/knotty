import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { Search, X } from 'lucide-react-native';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
}) => {
  return (
    <View style={styles.container}>
      <Search size={18} color={Colors.textSecondary} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          style={styles.clearBtn}
          activeOpacity={0.7}
        >
          <X size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: Colors.textPrimary,
    fontSize: 16,
    paddingVertical: 8,
  },
  clearBtn: {
    padding: 4,
  },
});
