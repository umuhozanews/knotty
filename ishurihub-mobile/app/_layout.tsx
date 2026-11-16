import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SessionRecoveryScreen } from '../components/SessionRecoveryScreen';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthenticatedNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthenticatedNavigator() {
  const { status, user, error, retry, signOut } = useAuth();
  const segments = useSegments();

  if (status === 'loading') {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (status === 'unavailable') {
    return <SessionRecoveryScreen message={error || 'Your session could not be checked.'} onRetry={() => void retry()} onSignOut={() => void signOut()} />;
  }
  const onLogin = segments[0] === 'login';
  const onIndex = segments[0] === undefined || segments[0] === 'index';
  if (!user && !onLogin && !onIndex) return <Redirect href="/login" />;
  if (user && onLogin) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F8F6' }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="student/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="canteen" options={{ headerShown: false }} />
      <Stack.Screen name="canteen-topup" options={{ headerShown: false }} />
      <Stack.Screen name="canteen-products" options={{ headerShown: false }} />
      <Stack.Screen name="library" options={{ headerShown: false }} />
      <Stack.Screen name="discipline" options={{ headerShown: false }} />
      <Stack.Screen name="portals/admin" options={{ headerShown: false }} />
      <Stack.Screen name="portals/librarian" options={{ headerShown: false }} />
      <Stack.Screen name="portals/student" options={{ headerShown: false }} />
      <Stack.Screen name="portals/parent" options={{ headerShown: false }} />
      <Stack.Screen name="portals/discipline" options={{ headerShown: false }} />
      <Stack.Screen name="portals/nurse" options={{ headerShown: false }} />
      <Stack.Screen name="portals/bursar" options={{ headerShown: false }} />
      <Stack.Screen name="portals/gate" options={{ headerShown: false }} />
      <Stack.Screen name="portals/permissions" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background } });
