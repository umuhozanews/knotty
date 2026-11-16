import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';

export function SessionRecoveryScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.recovery}>
        <Text style={styles.title}>Can’t reach IshuriHUB</Text>
        <Text style={styles.subtitle}>{message}</Text>
        <TouchableOpacity style={styles.button} onPress={onRetry}><Text style={styles.buttonText}>Try again</Text></TouchableOpacity>
        <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  recovery: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: Colors.textPrimary, fontSize: 27, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 },
  button: { minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, marginTop: 24 },
  buttonText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },
  signOutButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  signOutText: { color: Colors.textSecondary, fontWeight: '700' },
});
