/**
 * initiate-topup Edge Function
 *
 * Initiates a MoMo wallet top-up via Paypack CASHIN.
 * Flow: mobile app → this function → Paypack API (push to parent phone)
 *       → creates pending topup_request → returns request id + status
 *
 * The paypack-webhook function completes the flow when Paypack confirms payment.
 */

import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const PAYPACK_BASE = "https://consumers.paypack.rw/api";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...headers, "Content-Type": "application/json" } });

async function getPaypackToken(appId: string, appSecret: string): Promise<string> {
  const res = await fetch(`${PAYPACK_BASE}/auth/agents/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!res.ok) throw new Error(`Paypack auth failed: ${res.status}`);
  const data = await res.json() as { access: string };
  return data.access;
}

async function paypackCashin(token: string, amount: number, phone: string, ref: string): Promise<{ ref: string }> {
  const res = await fetch(`${PAYPACK_BASE}/transactions/cashin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, number: phone }),
  });
  const data = await res.json() as { ref?: string; message?: string };
  if (!res.ok || !data.ref) {
    throw new Error(data.message ?? `Paypack CASHIN failed: ${res.status}`);
  }
  return { ref: data.ref };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paypackAppId = Deno.env.get("PAYPACK_APP_ID");
  const paypackAppSecret = Deno.env.get("PAYPACK_APP_SECRET");

  if (!url || !anon || !service || !paypackAppId || !paypackAppSecret) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  // Verify caller auth
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "invalid_session" }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "invalid_json" }, 400); }

  const schoolId = typeof body.school_id === "string" ? body.school_id.trim() : "";
  const cardAssignmentId = typeof body.card_assignment_id === "string" ? body.card_assignment_id.trim() : "";
  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : 0;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(schoolId) || !uuid.test(cardAssignmentId) || !uuid.test(studentId)) {
    return json({ error: "invalid_request", detail: "Missing or invalid UUIDs" }, 400);
  }
  if (amount <= 0 || amount > 1_000_000) {
    return json({ error: "invalid_request", detail: "Amount out of range" }, 400);
  }
  if (!phone || !/^(\+?25)?(078|079|072|073)\d{7}$/.test(phone.replace(/\s+/g, ""))) {
    return json({ error: "invalid_request", detail: "Invalid Rwanda phone number" }, 400);
  }

  // Verify card is active in this school (use caller-scoped client)
  const { data: card, error: cardError } = await userClient
    .from("card_assignments")
    .select("id, student_id, wallet_balance, status")
    .eq("id", cardAssignmentId)
    .eq("school_id", schoolId)
    .not("status", "in", '("revoked","replaced")')
    .maybeSingle();

  if (cardError) return json({ error: "card_lookup_failed", detail: cardError.message }, 500);
  if (!card) return json({ error: "card_not_found" }, 404);

  // Initiate Paypack CASHIN
  let paypackRef: string;
  try {
    const token = await getPaypackToken(paypackAppId, paypackAppSecret);
    const result = await paypackCashin(token, amount, phone, cardAssignmentId);
    paypackRef = result.ref;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment provider error";
    return json({ error: "payment_provider_error", detail: message }, 502);
  }

  // Resolve caller person id
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: person } = await admin
    .from("persons")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Record pending topup_request
  const { data: requestData, error: insertError } = await admin.rpc("create_momo_topup_request", {
    p_school_id: schoolId,
    p_card_assignment_id: cardAssignmentId,
    p_student_id: studentId,
    p_amount: amount,
    p_phone: phone,
    p_payment_ref: paypackRef,
    p_initiated_by_person_id: person?.id ?? null,
  });

  if (insertError) return json({ error: "request_record_failed", detail: insertError.message }, 500);

  return json({
    request_id: requestData,
    payment_ref: paypackRef,
    status: "pending",
    amount,
    phone,
  });
});
