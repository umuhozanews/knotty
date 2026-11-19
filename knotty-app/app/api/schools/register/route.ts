import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function clean(s: string) {
  return s.replace(/[﻿​‌‍­]/g, "").trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    school_name, school_code, school_email, school_phone, school_address,
    school_type,
    admin_name, admin_email, admin_password,
  } = body;

  if (!school_name || !school_email || !admin_name || !admin_email || !admin_password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (admin_password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cleanSchoolEmail = clean(school_email).toLowerCase();
  const cleanAdminEmail = clean(admin_email).toLowerCase();
  const cleanAdminName = clean(admin_name);
  const nameParts = cleanAdminName.split(/\s+/);
  const firstName = nameParts[0] ?? cleanAdminName;
  const lastName = nameParts.slice(1).join(" ");

  const generatedCode = school_code
    ? clean(school_code).toUpperCase()
    : clean(school_name).trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 4) + Date.now().toString(36).slice(-2).toUpperCase();

  // 1. Create school (status = "pending" until platform admin approves)
  const { data: schoolInsert, error: schoolErr } = await admin
    .from("schools")
    .insert({
      organization_id: "918c8497-8c00-436b-b97c-29c3f68b9a76",
      name: clean(school_name),
      code: generatedCode,
      email: cleanSchoolEmail,
      phone: school_phone ? clean(school_phone) : null,
      address: school_address ? clean(school_address) : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (schoolErr || !schoolInsert) {
    return NextResponse.json({ error: schoolErr?.message || "Failed to create school" }, { status: 400 });
  }
  const schoolId = schoolInsert.id;

  // 2. Create auth user for the school admin
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: cleanAdminEmail,
    password: clean(admin_password),
    email_confirm: true,
    user_metadata: {
      full_name: cleanAdminName,
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (authErr || !authData?.user) {
    // Rollback school
    await admin.from("schools").delete().eq("id", schoolId);
    return NextResponse.json({ error: authErr?.message || "Failed to create admin account" }, { status: 400 });
  }
  const authUserId = authData.user.id;

  // 3. Bootstrap the first school admin (no actor needed — this is the initial setup)
  const { error: staffErr } = await admin.rpc(
    "bootstrap_school_admin" as never,
    {
      p_auth_user_id: authUserId,
      p_school_id: schoolId,
      p_legal_name: cleanAdminName,
      p_email: cleanAdminEmail,
      p_employee_number: `ADM-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      p_job_title: "School Administrator",
      p_department: "Administration",
      p_hired_on: new Date().toISOString().slice(0, 10),
    } as never
  );

  if (staffErr) {
    // Rollback
    await admin.auth.admin.deleteUser(authUserId);
    await admin.from("schools").delete().eq("id", schoolId);
    return NextResponse.json({ error: staffErr.message }, { status: 400 });
  }

  // Send welcome email (best-effort — never block registration if email fails)
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "IshuriHUB <onboarding@resend.dev>";
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const schoolDisplayName = clean(school_name);
      await resend.emails.send({
        from: fromEmail,
        to: cleanAdminEmail,
        subject: `Welcome to IshuriHUB — ${schoolDisplayName} is registered!`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <!-- Header -->
    <div style="background:#000;padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#16a34a;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:18px;font-weight:900;">I</span>
        </div>
        <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">IshuriHUB</span>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;">Smart School Management Platform</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="font-size:28px;">🎉</span>
        </div>
        <h1 style="margin:0;font-size:22px;font-weight:800;color:#111827;">Welcome, ${firstName}!</h1>
        <p style="margin:8px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
          <strong style="color:#111827;">${schoolDisplayName}</strong> has been successfully registered on IshuriHUB.
        </p>
      </div>
      <!-- Details card -->
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">Your Account Details</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#9ca3af;width:40%;">School Name</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${schoolDisplayName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#9ca3af;">School Code</td>
            <td style="padding:6px 0;font-size:13px;font-weight:700;color:#111827;font-family:monospace;">${generatedCode}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#9ca3af;">Login Email</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${cleanAdminEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#9ca3af;">Status</td>
            <td style="padding:6px 0;">
              <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;">Pending Review</span>
            </td>
          </tr>
        </table>
      </div>
      <!-- Next steps -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#111827;">What happens next?</p>
        <div style="space-y:8px;">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <div style="width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
              <span style="font-size:11px;font-weight:700;color:#1d4ed8;">1</span>
            </div>
            <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">Our platform team reviews your application <strong>(usually within 24 hours)</strong></p>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
            <div style="width:22px;height:22px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
              <span style="font-size:11px;font-weight:700;color:#1d4ed8;">2</span>
            </div>
            <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">Once approved, your school is <strong>activated</strong> and ready to use</p>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">
              <span style="font-size:11px;font-weight:700;color:#15803d;">3</span>
            </div>
            <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">Log in and start managing students, attendance, fees, and more!</p>
          </div>
        </div>
      </div>
      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://knotty-app-livid.vercel.app"}/login"
           style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.01em;">
          Go to Login →
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="border-top:1px solid #f3f4f6;padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        IshuriHUB · Smart School Management · Built by OrynTech Ltd<br/>
        <span style="font-size:10px;">If you didn't create this account, please ignore this email.</span>
      </p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (emailErr) {
      // Email failure is non-blocking — log and continue
      console.error("Welcome email failed:", emailErr);
    }
  }

  return NextResponse.json({
    school_id: schoolId,
    school_name: clean(school_name),
    school_code: generatedCode,
    admin_email: cleanAdminEmail,
    status: "pending",
    message: "School registered successfully. Your account is pending platform review.",
  });
}
