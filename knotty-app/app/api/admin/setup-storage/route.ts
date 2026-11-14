import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function clean(s: string): string {
  return s.replace(/﻿/g, "").replace(/​/g, "").replace(/‌/g, "").replace(/‍/g, "").replace(/­/g, "").trim();
}

export async function POST() {
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await admin.storage.getBucket("profile-photos");

  if (existing) {
    return NextResponse.json({ ok: true, message: "Bucket already exists" });
  }

  const { error } = await admin.storage.createBucket("profile-photos", {
    public: true,
    fileSizeLimit: 2097152,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Bucket profile-photos created" });
}
