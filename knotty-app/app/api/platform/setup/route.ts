import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// One-time setup: creates platform_admins table and registers a platform admin.
// Protected by PLATFORM_SETUP_KEY env var.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { setup_key, admin_email } = body;

  const expectedKey = process.env.PLATFORM_SETUP_KEY;
  if (!expectedKey || setup_key !== expectedKey) {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
  }

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create platform_admins table via SQL (using exec RPC if available, else raw)
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.platform_admins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id uuid NOT NULL UNIQUE,
      email text NOT NULL,
      full_name text NOT NULL DEFAULT '',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'platform_admins' AND policyname = 'Platform admins can read own record'
      ) THEN
        CREATE POLICY "Platform admins can read own record"
          ON public.platform_admins FOR SELECT
          USING (auth.uid() = auth_user_id);
      END IF;
    END $$;
  `;

  // Use Supabase SQL endpoint (service_role bypasses RLS for schema changes)
  const sqlRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql: createTableSQL }),
  });

  // If exec_sql doesn't exist, try direct table insert approach
  // (table may already exist from manual setup)

  // 2. Find the auth user by email
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const targetEmail = admin_email?.trim().toLowerCase();
  const authUser = users?.users?.find((u: any) => u.email?.toLowerCase() === targetEmail);
  if (!authUser) {
    return NextResponse.json({ error: `No auth user found with email: ${targetEmail}` }, { status: 404 });
  }

  // 3. Try to insert into platform_admins (table must exist)
  const { error: insertErr } = await admin
    .from("platform_admins" as any)
    .upsert({
      auth_user_id: authUser.id,
      email: authUser.email,
      full_name: (authUser.user_metadata?.full_name as string) || authUser.email,
      is_active: true,
    }, { onConflict: "auth_user_id" });

  if (insertErr) {
    // Table doesn't exist yet — return instructions
    return NextResponse.json({
      error: "platform_admins table not found. Run the SQL migration first.",
      sql: createTableSQL,
      auth_user_id: authUser.id,
      email: authUser.email,
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    auth_user_id: authUser.id,
    email: authUser.email,
    message: `${authUser.email} is now a platform admin`,
  });
}
