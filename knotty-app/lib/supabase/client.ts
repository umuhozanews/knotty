import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicConfig } from "./env";

export function createClient(): SupabaseClient<Database> {
  const { url, key } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}
