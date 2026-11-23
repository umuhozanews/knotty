import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

function clean(s: string): string {
  return s.replace(/﻿/g, "").replace(/​/g, "").replace(/‌/g, "").replace(/‍/g, "").replace(/­/g, "").trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { staff_auth_user_id, new_password, actor_auth_user_id } = body;

  if (!staff_auth_user_id || !new_password || !actor_auth_user_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the caller's session matches the declared actor
  const supabaseSession = await createServerClient();
  const { data: { user: sessionUser } } = await supabaseSession.auth.getUser();
  if (!sessionUser || sessionUser.id !== actor_auth_user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the actor is an ADMIN by checking their person + role
  const { data: actorPerson } = await supabaseAdmin
    .from("persons")
    .select("id")
    .eq("auth_user_id", actor_auth_user_id)
    .maybeSingle();

  if (!actorPerson) {
    return NextResponse.json({ error: "Actor not found" }, { status: 403 });
  }

  const { data: actorRole } = await supabaseAdmin
    .from("school_membership_roles")
    .select("role_key")
    .eq("person_id", actorPerson.id)
    .eq("status", "active")
    .maybeSingle();

  if (!actorRole || actorRole.role_key !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can reset staff passwords" }, { status: 403 });
  }

  const cleanPw = clean(new_password);
  if (cleanPw.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(staff_auth_user_id, {
    password: cleanPw,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update hint in staff_records (best-effort)
  await Promise.resolve(
    supabaseAdmin
      .from("staff_records")
      .update({ hint_password: cleanPw })
      .eq("school_membership_id", staff_auth_user_id)
  ).catch(() => {});

  return NextResponse.json({ success: true });
}
