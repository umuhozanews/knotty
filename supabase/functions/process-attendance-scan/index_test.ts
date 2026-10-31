import { createScanHandler } from "./index.ts";

const schoolId = "48000000-0000-4000-8000-000000000001";
const deviceId = "58000000-0000-4000-8000-000000000001";
const eventId = "68000000-0000-4000-8000-000000000001";
const idempotencyKey = "78000000-0000-4000-8000-000000000001";
const allowedOrigin = "https://app.example.invalid";

function handlerFor(outcome: string, rejectionCode: string | null = null) {
  const calls: string[] = [];
  const handler = createScanHandler({
    env: (name) =>
      ({
        ATTENDANCE_SCAN_ALLOWED_ORIGINS: allowedOrigin,
        SUPABASE_URL: "http://supabase.example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        CARD_IDENTIFIER_HMAC_KEY: "test-card-hmac-key",
      })[name],
    createAdminClient: () => ({
      rpc: async (name) => {
        calls.push(name);
        if (name === "process_attendance_scan") {
          return { data: eventId, error: null };
        }
        return {
          data: [{
            scan_event_id: eventId,
            outcome,
            rejection_code: rejectionCode,
          }],
          error: null,
        };
      },
    }),
  });
  return { handler, calls };
}

function scanRequest(credential = "d".repeat(48), origin = allowedOrigin) {
  return new Request(
    "https://functions.example.invalid/process-attendance-scan",
    {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-device-credential": credential,
      },
      body: JSON.stringify({
        school_id: schoolId,
        device_id: deviceId,
        card_identifier: "test-card-uid",
        idempotency_key: idempotencyKey,
        direction: "in",
      }),
    },
  );
}

Deno.test("accepted scan returns a bounded outcome with CORS and no identity", async () => {
  const { handler, calls } = handlerFor("accepted");
  const response = await handler(scanRequest());
  const body = await response.json();
  if (
    response.status !== 200 || body.outcome !== "accepted" ||
    body.scan_event_id !== eventId
  ) throw new Error("accepted contract mismatch");
  if (response.headers.get("access-control-allow-origin") !== allowedOrigin) {
    throw new Error("allowed origin missing from CORS response");
  }
  if (
    "student_id" in body || "staff_record_id" in body ||
    "card_identifier" in body
  ) throw new Error("response leaked scan identity");
  if (
    calls.join(",") !== "process_attendance_scan,get_attendance_scan_outcome"
  ) throw new Error("expected both trusted RPCs");
});

Deno.test("rejected scan returns only the bounded rejection result", async () => {
  const { handler } = handlerFor("rejected", "unknown_card");
  const response = await handler(scanRequest());
  const body = await response.json();
  if (body.outcome !== "rejected" || body.rejection_code !== "unknown_card") {
    throw new Error("rejected contract mismatch");
  }
  if (
    Object.keys(body).sort().join(",") !==
      "outcome,rejection_code,scan_event_id"
  ) throw new Error("rejected response has unexpected fields");
});

Deno.test("duplicate scan is distinct from accepted and rejected", async () => {
  const { handler } = handlerFor("duplicate");
  const response = await handler(scanRequest());
  const body = await response.json();
  if (body.outcome !== "duplicate" || body.rejection_code !== null) {
    throw new Error("duplicate contract mismatch");
  }
});

Deno.test("short device credential is rejected before RPC", async () => {
  const { handler, calls } = handlerFor("accepted");
  const response = await handler(scanRequest("short"));
  if (
    response.status !== 401 || (await response.json()).error !== "unauthorized"
  ) throw new Error("invalid device credential was accepted");
  if (response.headers.get("access-control-allow-origin") !== allowedOrigin) {
    throw new Error("error response omitted allowed-origin CORS headers");
  }
  if (calls.length !== 0) {
    throw new Error("RPC ran for an invalid device credential");
  }
});

Deno.test("preflight allows the custom device header for a trusted origin", async () => {
  const { handler } = handlerFor("accepted");
  const request = new Request(
    "https://functions.example.invalid/process-attendance-scan",
    {
      method: "OPTIONS",
      headers: {
        origin: allowedOrigin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-device-credential",
      },
    },
  );
  const response = await handler(request);
  if (response.status !== 204) {
    throw new Error("preflight did not return no-content");
  }
  if (response.headers.get("access-control-allow-origin") !== allowedOrigin) {
    throw new Error("trusted origin not allowed");
  }
  if (
    !response.headers.get("access-control-allow-headers")?.includes(
      "x-device-credential",
    )
  ) throw new Error("device header missing from preflight");
});

Deno.test("untrusted origin is rejected and not reflected", async () => {
  const { handler, calls } = handlerFor("accepted");
  const response = await handler(
    scanRequest("d".repeat(48), "https://untrusted.example.invalid"),
  );
  if (
    response.status !== 403 ||
    response.headers.has("access-control-allow-origin")
  ) throw new Error("untrusted origin was reflected");
  if (calls.length !== 0) throw new Error("RPC ran for an untrusted origin");
});
