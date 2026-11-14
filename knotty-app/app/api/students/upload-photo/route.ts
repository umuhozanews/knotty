import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function clean(s: string): string {
  return s.replace(/﻿/g, "").replace(/​/g, "").replace(/‌/g, "").replace(/‍/g, "").replace(/­/g, "").trim();
}

export async function POST(req: NextRequest) {
  const { student_id, school_id, photo_base64, content_type } = await req.json();

  if (!student_id || !school_id || !photo_base64) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const mimeType = content_type && allowedTypes.includes(content_type) ? content_type : "image/jpeg";
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const base64Data = photo_base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const storagePath = `${school_id}/${student_id}.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("profile-photos")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 400 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("profile-photos")
    .getPublicUrl(storagePath);

  const { error: updateErr } = await supabaseAdmin.rpc("update_student_photo", {
    p_school_id:  school_id,
    p_student_id: student_id,
    p_photo_url:  publicUrl,
  });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ url: publicUrl });
}
