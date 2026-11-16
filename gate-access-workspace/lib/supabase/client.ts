import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicConfig, checkSupabaseConfiguration } from "./env";

let browserClientInstance: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return checkSupabaseConfiguration().configured;
}

export function createClient(): SupabaseClient<Database> {
  const { url, key } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}

export function getSafeBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClientInstance) {
    try {
      browserClientInstance = createClient();
    } catch {
      return null;
    }
  }
  return browserClientInstance;
}
