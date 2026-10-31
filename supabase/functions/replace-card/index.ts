import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...headers, "Content-Type": "application/json" } });
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), hmacSecret = Deno.env.get("CARD_IDENTIFIER_HMAC_KEY");
  if (!url || !anon || !service || !hmacSecret) return respond({ error: "server_configuration_error" }, 500);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "unauthorized" }, 401);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
    body = parsed as Record<string, unknown>;
  } catch { return respond({ error: "invalid_json" }, 400); }
  const schoolId = typeof body.school_id === "string" ? body.school_id : "";
  const oldCardId = typeof body.old_card_assignment_id === "string" ? body.old_card_assignment_id : "";
  const identifierKind = body.identifier_kind === "nfc_uid" || body.identifier_kind === "qr_token" ? body.identifier_kind : "";
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(schoolId) || !uuid.test(oldCardId) || !identifierKind || !identifier || identifier.length > 512 || reason.length < 3) return respond({ error: "invalid_replacement_request" }, 400);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond({ error: "invalid_session" }, 401);
  const { data: allowed, error: permissionError } = await userClient.rpc("can_manage_cards", { p_school_id: schoolId });
  if (permissionError || allowed !== true) return respond({ error: "forbidden" }, 403);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hmacSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(identifier)));
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: newCardId, error } = await admin.rpc("replace_card_from_edge", {
    p_actor_auth_user_id: user.id, p_school_id: schoolId, p_old_card_id: oldCardId,
    p_identifier_kind: identifierKind,
    p_identifier_digest: `\\x${hex(digest)}`, p_digest_key_version: 1, p_reason: reason,
  });
  if (error || typeof newCardId !== "string") return respond({ error: "card_replacement_failed" }, 422);
  return respond({ card_assignment_id: newCardId, status: "issued" }, 201);
});
