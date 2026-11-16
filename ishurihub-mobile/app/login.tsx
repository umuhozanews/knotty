import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GraduationCap } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandIcon}><GraduationCap size={30} color={Colors.primary} /></View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with your IshuriHUB school account.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholder="you@school.rw"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              editable={!submitting}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              editable={!submitting}
              onSubmitEditing={() => void handleSignIn()}
              returnKeyType="go"
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void handleSignIn()} disabled={submitting} activeOpacity={0.8}>
              {submitting ? <ActivityIndicator color={Colors.textWhite} /> : <Text style={styles.buttonText}>Sign in</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.footer}>Your school role and access are checked by the server.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight, marginBottom: 22 },
  title: { color: Colors.textPrimary, fontSize: 27, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 },
  form: { marginTop: 28, gap: 10 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderColor: Colors.borderInput, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, color: Colors.textPrimary, fontSize: 16 },
  error: { color: Colors.absent, fontSize: 13, lineHeight: 19, marginTop: 3 },
  button: { minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, marginTop: 12 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: Colors.textWhite, fontSize: 16, fontWeight: '700' },
  footer: { color: Colors.textTertiary, fontSize: 12, lineHeight: 18, marginTop: 24 },
});
