import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function clean(s: string): string {
  return s.replace(/﻿/g, "").replace(/​/g, "").replace(/‌/g, "").replace(/‍/g, "").replace(/­/g, "").trim();
}

// Fallback login for school-scoped synthetic auth emails.
// When a user's real email was used to register at multiple schools,
// the auth.users table holds a synthetic email (s.xxx.yyy@students.ishurihub.school
// or w.xxx.yyy@staff.ishurihub.school) so we must look up all matching auth_user_ids
// via the contact-points table, then try signing in with each synthetic email.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const anonKey = clean(process.env.SUPABASE_ANON_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");

  if (!serviceRoleKey || !anonKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up all auth_user_ids whose real contact email matches
  const { data: rows, error: rpcErr } = await adminClient.rpc(
    "get_auth_user_ids_for_contact",
    { p_contact_email: email.trim().toLowerCase() }
  );

  if (rpcErr || !rows || (rows as any[]).length === 0) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // For each auth_user_id, fetch their synthetic email and attempt sign-in
  // using the classic anon JWT (not the publishable key) so GoTrue accepts it.
  for (const row of rows as { auth_user_id: string }[]) {
    const { data: authUser } = await adminClient.auth.admin.getUserById(row.auth_user_id);
    if (!authUser?.user?.email) continue;

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });

    if (!signInErr && signInData?.session) {
      return NextResponse.json({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      });
    }
  }

  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}
