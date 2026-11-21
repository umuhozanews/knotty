import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getPlatformAdminUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// PATCH /api/platform/schools  { schoolId, status: "active" | "suspended" | "pending" }
export async function PATCH(req: NextRequest) {
  const userId = await getPlatformAdminUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is a platform admin
  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_admins" as any)
    .select("id")
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!platformAdmin) {
    return NextResponse.json({ error: "Forbidden — platform admins only" }, { status: 403 });
  }

  const { schoolId, status } = await req.json();
  if (!schoolId || !["active", "suspended", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await admin.from("schools").update({ status }).eq("id", schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
