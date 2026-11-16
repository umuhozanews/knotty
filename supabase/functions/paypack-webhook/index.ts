/**
 * paypack-webhook Edge Function
 *
 * Receives Paypack payment confirmation webhooks.
 * Validates the webhook signature, finds the pending topup_request,
 * and credits the wallet via complete_momo_topup() (service role).
 *
 * Paypack sends a POST with the transaction result including the ref.
 */

import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("PAYPACK_WEBHOOK_SECRET");

  if (!url || !service) return json({ error: "server_configuration_error" }, 500);

  // Validate Paypack webhook signature if secret is configured
  if (webhookSecret) {
    const signature = request.headers.get("x-paypack-signature") ?? "";
    const rawBody = await request.text();

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
    );
    const expectedHex = Array.from(expected, (b) => b.toString(16).padStart(2, "0")).join("");

    if (signature !== expectedHex) {
      return json({ error: "invalid_signature" }, 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch { return json({ error: "invalid_json" }, 400); }

    return await processPayload(url, service, payload);
  }

  // No webhook secret configured — still process but log the warning
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch { return json({ error: "invalid_json" }, 400); }

  return await processPayload(url, service, payload);
});

async function processPayload(
  url: string,
  service: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const json = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

  // Paypack webhook payload shape: { ref, status, kind, amount, ... }
  const paypackRef = typeof payload.ref === "string" ? payload.ref.trim() : "";
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const status = typeof payload.status === "string" ? payload.status : "";
  const providerRef = typeof payload.provider_ref === "string" ? payload.provider_ref : null;

  // Only process successful CASHIN completions
  if (kind !== "CASHIN" || status !== "successful") {
    return json({ received: true, action: "skipped", reason: `kind=${kind} status=${status}` });
  }

  if (!paypackRef) return json({ error: "missing_ref" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await admin.rpc("complete_momo_topup", {
    p_payment_ref: paypackRef,
    p_provider_ref: providerRef,
  });

  if (error) {
    // Not found or already processed — return 200 to prevent Paypack retry loops
    if (error.message?.includes("not found")) {
      return json({ received: true, action: "skipped", reason: "request_not_found_or_already_processed" });
    }
    return json({ error: "topup_completion_failed", detail: error.message }, 500);
  }

  return json({ received: true, action: "completed", result: data });
}
