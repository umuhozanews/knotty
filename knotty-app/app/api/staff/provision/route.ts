import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function clean(s: string): string {
  return s
    .replace(/﻿/g, "")
    .replace(/​/g, "")
    .replace(/‌/g, "")
    .replace(/‍/g, "")
    .replace(/­/g, "")
    .trim();
}

const ROLE_TITLES: Record<string, string> = {
  TEACHER: "Teacher",
  BURSAR: "Bursar",
  DISCIPLINE: "Discipline Officer",
  NURSE: "School Nurse",
  LIBRARIAN: "Librarian",
  CANTEEN: "Canteen Staff",
  GATEKEEPER: "Gate Security Officer",
  MATERIALS: "Materials & Inventory Officer",
  ADMIN: "Administrator",
  SCHOOL_MANAGER: "School Manager",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    school_id, legal_name, email, role_key, password,
    actor_auth_user_id,
    employee_number: employeeNumberInput,
    job_title: jobTitleOverride,
    department,
    qualification,
    specialization,
  } = body;

  if (!school_id || !legal_name || !email || !role_key || !actor_auth_user_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cleanEmail = clean(email);
  const cleanName = clean(legal_name);
  const cleanPassword = password ? clean(password) : "Ishuri@Staff2024";

  // Use provided employee number or generate one
  const prefix = (role_key as string).slice(0, 3).toUpperCase();
  const employeeNumber = employeeNumberInput
    ? clean(String(employeeNumberInput))
    : `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const jobTitle = jobTitleOverride ? clean(jobTitleOverride) : (ROLE_TITLES[role_key] ?? role_key);

  // Split legal name for metadata
  const nameParts = cleanName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? cleanName;
  const lastName = nameParts.slice(1).join(" ");

  // Always use a school-scoped synthetic auth email so the same real email
  // can be a staff member at multiple schools without colliding in auth.users.
  const empNumClean = employeeNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
  const syntheticEmail = `w.${empNumClean}.${school_id.slice(-8)}@staff.ishurihub.school`;

  // 1. Create auth user
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    password: cleanPassword,
    email_confirm: true,
    user_metadata: {
      full_name: cleanName,
      first_name: firstName,
      last_name: lastName,
      must_change_password: true,
    },
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const staffAuthUserId = authData.user.id;

  // 2. Register staff via DB function
  const { data: staffId, error: regErr } = await supabaseAdmin.rpc(
    "register_staff_from_edge" as never,
    {
      p_actor_auth_user_id: actor_auth_user_id,
      p_staff_auth_user_id: staffAuthUserId,
      p_school_id: school_id,
      p_legal_name: cleanName,
      p_email: cleanEmail,
      p_role_key: role_key,
      p_employee_number: employeeNumber,
      p_job_title: jobTitle,
      p_hired_on: new Date().toISOString().slice(0, 10),
      p_department: department ? clean(department) : null,
      p_qualification: qualification ? clean(qualification) : null,
      p_specialization: specialization ? clean(specialization) : null,
    }
  );

  if (regErr) {
    await supabaseAdmin.auth.admin.deleteUser(staffAuthUserId);
    return NextResponse.json({ error: regErr.message }, { status: 400 });
  }

  // Store the admin-set password hint in staff_records (best-effort)
  if (staffId) {
    try {
      await supabaseAdmin
        .from("staff_records")
        .update({ hint_password: cleanPassword })
        .eq("id", String(staffId));
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ staff_id: staffId, email: cleanEmail, synthetic_email: syntheticEmail, employee_number: employeeNumber });
}
