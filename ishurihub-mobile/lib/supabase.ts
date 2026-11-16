import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  const storage = Platform.OS === 'web' ? undefined : {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };

  client = createClient<Database>(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      ...(storage ? { storage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}
