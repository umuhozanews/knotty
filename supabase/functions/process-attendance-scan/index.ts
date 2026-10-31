import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacSha256(keyValue: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(keyValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cardHmacKey = Deno.env.get("CARD_IDENTIFIER_HMAC_KEY");
  if (!url || !serviceRoleKey || !cardHmacKey) return Response.json({ error: "server_configuration_error" }, { status: 500 });

  const deviceCredential = request.headers.get("x-device-credential") ?? "";
  if (deviceCredential.length < 32 || deviceCredential.length > 256) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const schoolId = typeof body.school_id === "string" ? body.school_id : "";
  const deviceId = typeof body.device_id === "string" ? body.device_id : "";
  const cardIdentifier = typeof body.card_identifier === "string" ? body.card_identifier.trim() : "";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  const direction = body.direction === "in" || body.direction === "out" ? body.direction : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(schoolId) || !uuid.test(deviceId) || !uuid.test(idempotencyKey) || !cardIdentifier || cardIdentifier.length > 512 || !direction) {
    return Response.json({ error: "invalid_scan_request" }, { status: 400 });
  }

  const [deviceDigest, cardDigest] = await Promise.all([
    sha256(deviceCredential),
    hmacSha256(cardHmacKey, cardIdentifier),
  ]);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("process_attendance_scan", {
    p_school_id: schoolId,
    p_device_id: deviceId,
    p_device_credential_digest: `\\x${toHex(deviceDigest)}`,
    p_identifier_digest: `\\x${toHex(cardDigest)}`,
    p_idempotency_key: idempotencyKey,
    p_scan_direction: direction,
  });
  if (error || typeof data !== "string") return Response.json({ error: "scan_rejected" }, { status: 403 });
  // Devices receive no identity, attendance detail, card state, or balance.
  return Response.json({ scan_event_id: data, outcome: "processed" });
});
