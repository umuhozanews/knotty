import { NextResponse } from "next/server";
import { checkSupabaseConfiguration } from "@/lib/supabase/env";

export async function GET() {
  const envCheck = checkSupabaseConfiguration();
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  let dbStatus = "NOT_CONFIGURED";
  let dbError = null;

  if (envCheck.configured) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
      const res = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim(),
        },
      });

      if (res.ok) {
        dbStatus = "CONNECTED";
      } else {
        dbStatus = "UNREACHABLE";
        dbError = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      dbStatus = "CONNECTION_REFUSED";
      dbError = err?.message || "Failed connecting to database";
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      supabaseConfigured: envCheck.configured,
      missingVariables: envCheck.missing,
      validationErrors: envCheck.errors,
      keySource: envCheck.keySource,
      hasServiceRoleKey,
    },
    database: {
      status: dbStatus,
      error: dbError,
    },
  });
}
