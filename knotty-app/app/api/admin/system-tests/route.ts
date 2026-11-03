import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkSupabaseConfiguration } from "@/lib/supabase/env";

const ADMIN_ROLES = ["ADMIN", "SCHOOL_MANAGER"];

export async function GET() {
  const envCheck = checkSupabaseConfiguration();
  if (!envCheck.configured) {
    return NextResponse.json({ error: "Diagnostics are unavailable." }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: person } = await supabase
      .from("persons")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const { data: memberships } = await supabase
      .from("school_memberships")
      .select("id, school_id")
      .eq("person_id", person.id)
      .eq("status", "active");

    const membershipIds = (memberships ?? []).map((membership) => membership.id);
    if (membershipIds.length === 0) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const { data: roles } = await supabase
      .from("school_membership_roles")
      .select("role_key")
      .in("membership_id", membershipIds)
      .eq("status", "active")
      .in("role_key", ADMIN_ROLES);

    if (!roles?.length) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    let dbStatus = "NOT_CONFIGURED";
    if (envCheck.configured) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
      const key = (
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )!.trim();
      try {
        const response = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key },
          cache: "no-store",
        });
        dbStatus = response.ok ? "CONNECTED" : "UNREACHABLE";
      } catch {
        dbStatus = "CONNECTION_REFUSED";
      }
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: { status: dbStatus },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Diagnostics are unavailable." }, { status: 503 });
  }
}
