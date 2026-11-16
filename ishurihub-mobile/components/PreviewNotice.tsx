import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function PreviewNotice({ children = 'Preview only: this module uses sample data and does not save changes.' }: { children?: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F5D99A', backgroundColor: '#FFFAE8' },
  text: { color: '#72540E', fontSize: 12, lineHeight: 17, fontWeight: '500' },
});
