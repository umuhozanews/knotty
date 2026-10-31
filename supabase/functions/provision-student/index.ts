import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { deleteUnregisteredAuthUser, isDefinitiveDatabaseFailure } from "./compensation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);

  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const schoolId = typeof input.school_id === "string" ? input.school_id : "";
  const contactType = input.contact_type === "email" ? "email" : input.contact_type === "phone" ? "phone" : "";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  const admissionNumber = typeof input.admission_number === "string" ? input.admission_number.trim() : "";
  const legalName = typeof input.legal_name === "string" ? input.legal_name.trim() : "";
  if (!schoolId || !contactType || !admissionNumber || !legalName || !contact) return json({ error: "required_fields_missing" }, 400);

  const normalizedContact = contactType === "email" ? contact.toLowerCase() : contact.replace(/[\s()-]/g, "");
  if ((contactType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact))
    || (contactType === "phone" && !/^\+[1-9]\d{7,14}$/.test(normalizedContact))) {
    return json({ error: "valid_email_or_e164_phone_required" }, 400);
  }

  const actorClient = createClient(url, anonKey, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: actor }, error: actorError } = await actorClient.auth.getUser();
  if (actorError || !actor) return json({ error: "invalid_session" }, 401);
  const { data: allowed, error: permissionError } = await actorClient.rpc("can_register_students", { p_school_id: schoolId });
  if (permissionError || allowed !== true) return json({ error: "forbidden" }, 403);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const credential = contactType === "email" ? { email: normalizedContact } : { phone: normalizedContact };
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    ...credential,
    email_confirm: false,
    phone_confirm: false,
    user_metadata: {},
  });
  if (createError || !created.user) return json({ error: "account_provisioning_failed" }, 409);

  const rpcArgs = {
    p_actor_auth_user_id: actor.id,
    p_student_auth_user_id: created.user.id,
    p_school_id: schoolId,
    p_admission_number: admissionNumber,
    p_legal_name: legalName,
    p_date_of_birth: typeof input.date_of_birth === "string" ? input.date_of_birth : null,
    p_gender: typeof input.gender === "string" ? input.gender : null,
    p_nationality: typeof input.nationality === "string" ? input.nationality : null,
    p_contact_type: contactType,
    p_contact_value: contact,
    p_contact_normalized: normalizedContact,
    p_academic_year_id: typeof input.academic_year_id === "string" ? input.academic_year_id : null,
    p_class_section_id: typeof input.class_section_id === "string" ? input.class_section_id : null,
  };
  const { data: studentId, error: registrationError } = await admin.rpc("register_student_from_edge", rpcArgs);
  if (registrationError || typeof studentId !== "string") {
    if (!isDefinitiveDatabaseFailure(registrationError)) {
      // A transport failure or malformed response can hide a committed RPC.
      // Deleting Auth here could orphan a committed student record.
      console.error("Student provisioning result requires reconciliation", {
        authUserId: created.user.id,
      });
      return json({ error: "student_registration_outcome_unknown" }, 503);
    }
    const cleanup = await deleteUnregisteredAuthUser(
      (userId) => admin.auth.admin.deleteUser(userId),
      created.user.id,
    );
    if (cleanup === "cleanup_pending") {
      // Auth and Postgres cannot share a transaction. Record only the opaque
      // Auth UUID for operator reconciliation; never log the submitted contact.
      console.error("Student provisioning Auth cleanup pending", {
        authUserId: created.user.id,
      });
      return json({ error: "student_registration_cleanup_pending" }, 500);
    }
    return json({ error: "student_registration_failed" }, 422);
  }

  // Account exists but remains pending until the invited email/phone is
  // verified and activate_student_account() is called by that Auth identity.
  const authPublic = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: otpError } = await authPublic.auth.signInWithOtp({
    ...credential,
    options: { shouldCreateUser: false },
  });
  if (otpError) return json({ student_id: studentId, activation_delivery: "pending_retry" }, 202);
  return json({ student_id: studentId, activation_delivery: "sent" }, 201);
});
