import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** Create only for narrowly scoped trusted server operations. Never use for user requests. */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for the Supabase admin client.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this server-only operation.");
  }
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a server-only key.");
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
