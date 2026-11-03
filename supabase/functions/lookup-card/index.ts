import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const encode = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...headers, "Content-Type": "application/json" } });
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return encode({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hmacSecret = Deno.env.get("CARD_IDENTIFIER_HMAC_KEY");
  if (!url || !anon || !service || !hmacSecret) return encode({ error: "server_configuration_error" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return encode({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch { return encode({ error: "invalid_json" }, 400); }

  const schoolId = typeof body.school_id === "string" ? body.school_id : "";
  const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid.trim().toUpperCase() : "";
  const identifierKind = body.identifier_kind === "qr_token" ? "qr_token" : "nfc_uid";

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(schoolId) || !rawUid || rawUid.length > 512) return encode({ error: "invalid_request" }, 400);

  // Verify caller is an authenticated user
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return encode({ error: "invalid_session" }, 401);

  // HMAC the raw NFC UID (same algorithm as issue-card)
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawUid)));

  // Look up by digest via service_role (bypasses RLS, accesses private schema)
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("lookup_card_holder_by_digest", {
    p_school_id: schoolId,
    p_keyed_digest: `\\x${hex(digest)}`,
    p_identifier_kind: identifierKind,
  });

  if (error) return encode({ error: "lookup_failed", detail: error.message }, 500);
  const holder = Array.isArray(data) ? data[0] : data;
  if (!holder) return encode({ error: "card_not_found" }, 404);

  return encode(holder, 200);
});
