import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Strip BOM (U+FEFF) and common invisible Unicode characters from any string
function clean(s: string): string {
  return s
    .replace(/﻿/g, "")   // BOM / zero-width no-break space
    .replace(/​/g, "")   // zero-width space
    .replace(/‌/g, "")   // zero-width non-joiner
    .replace(/‍/g, "")   // zero-width joiner
    .replace(/­/g, "")   // soft hyphen
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    school_id, contact_type, contact, admission_number, legal_name,
    date_of_birth, gender, nationality, academic_year_id, class_section_id,
    actor_auth_user_id, password,
  } = body;

  if (!school_id || !contact || !admission_number || !legal_name || !actor_auth_user_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Strip BOM from env vars (can occur if key was pasted from a document)
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error: missing Supabase keys" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rawContact = clean(contact);
  const rawPassword = password ? clean(password) : "Ishuri@2024";
  const cleanAdmission = clean(admission_number);
  const email = contact_type === "email"
    ? rawContact
    : `${cleanAdmission.toLowerCase().replace(/\s+/g, "")}@ishurihub.school`;

  // 1. Create auth user for the student
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: rawPassword,
    email_confirm: true,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const studentAuthUserId = authData.user.id;

  // 2. Register student via the trusted DB function
  const { data: studentId, error: regErr } = await supabaseAdmin.rpc(
    "register_student_from_edge",
    {
      p_actor_auth_user_id: actor_auth_user_id,
      p_student_auth_user_id: studentAuthUserId,
      p_school_id: school_id,
      p_admission_number: cleanAdmission,
      p_legal_name: clean(legal_name),
      p_date_of_birth: date_of_birth || null,
      p_gender: gender || null,
      p_nationality: nationality || null,
      p_contact_type: contact_type,
      p_contact_value: rawContact,
      p_contact_normalized: rawContact.toLowerCase(),
      p_academic_year_id: academic_year_id || null,
      p_class_section_id: class_section_id || null,
    }
  );

  if (regErr) {
    await supabaseAdmin.auth.admin.deleteUser(studentAuthUserId);
    const msg = regErr.message.includes("active year and matching class required")
      ? "The selected class is not linked to an active academic year. Go to Settings → Academics, activate an academic year, and make sure the class belongs to it."
      : regErr.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    student_id: studentId,
    activation_delivery: "created",
    email,
  });
}
