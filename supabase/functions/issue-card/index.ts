import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const encode = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...headers, "Content-Type": "application/json" } });
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return encode({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), hmacSecret = Deno.env.get("CARD_IDENTIFIER_HMAC_KEY");
  if (!url || !anon || !service || !hmacSecret) return encode({ error: "server_configuration_error" }, 500);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return encode({ error: "unauthorized" }, 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return encode({ error: "invalid_json" }, 400); }
  const schoolId = typeof body.school_id === "string" ? body.school_id : "";
  const kind = body.holder_kind === "student" || body.holder_kind === "staff" ? body.holder_kind : "";
  const studentId = typeof body.student_id === "string" ? body.student_id : null;
  const staffId = typeof body.staff_record_id === "string" ? body.staff_record_id : null;
  const identifierKind = body.identifier_kind === "nfc_uid" || body.identifier_kind === "qr_token" ? body.identifier_kind : "";
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(schoolId) || !kind || (kind === "student" ? !uuid.test(studentId ?? "") || staffId !== null : !uuid.test(staffId ?? "") || studentId !== null)
    || !identifierKind || !identifier || identifier.length > 512) return encode({ error: "invalid_card_request" }, 400);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return encode({ error: "invalid_session" }, 401);
  const { data: allowed, error: permissionError } = await userClient.rpc("can_issue_card", { p_school_id: schoolId });
  if (permissionError || allowed !== true) return encode({ error: "forbidden" }, 403);

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hmacSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(identifier)));
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: cardId, error } = await admin.rpc("issue_card_from_edge", {
    p_actor_auth_user_id: user.id, p_school_id: schoolId, p_holder_kind: kind,
    p_student_id: studentId, p_staff_record_id: staffId,
    p_identifier_kind: identifierKind, p_identifier_digest: `\\x${hex(digest)}`, p_digest_key_version: 1,
  });
  if (error || typeof cardId !== "string") return encode({ error: "card_issue_failed" }, 422);
  return encode({ card_assignment_id: cardId, status: "issued" }, 201);
});
