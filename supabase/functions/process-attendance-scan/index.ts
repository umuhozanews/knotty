import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const encoder = new TextEncoder();
const allowedRequestHeaders = new Set([
  "apikey",
  "authorization",
  "content-type",
  "x-client-info",
  "x-device-credential",
]);
const rejectionCodes = new Set([
  "inactive_card_or_identifier",
  "inactive_staff",
  "inactive_student",
  "no_arrival_record",
  "school_scope_mismatch",
  "unknown_card",
]);
const outcomes = new Set(["accepted", "rejected", "duplicate"]);

type ScanRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
};

type HandlerDependencies = {
  env: (name: string) => string | undefined;
  createAdminClient: (url: string, key: string) => ScanRpcClient;
};

function configuredOrigins(value: string | undefined): Set<string> {
  const origins =
    value?.split(",").map((part) => part.trim()).filter(Boolean) ??
      ["http://localhost:3000", "http://127.0.0.1:3000"];
  return new Set(origins.filter((origin) => {
    try {
      const parsed = new URL(origin);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        parsed.origin === origin;
    } catch {
      return false;
    }
  }));
}

function corsHeaders(origin: string | null, origins: Set<string>): Headers {
  const headers = new Headers({ Vary: "Origin" });
  if (origin && origins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      [...allowedRequestHeaders].join(", "),
    );
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
  origins: Set<string>,
): Response {
  const headers = corsHeaders(origin, origins);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function hmacSha256(
  keyValue: string,
  value: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

export function createScanHandler(dependencies: HandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const origins = configuredOrigins(
      dependencies.env("ATTENDANCE_SCAN_ALLOWED_ORIGINS"),
    );
    try {
      const headers = corsHeaders(origin, origins);

      if (origin && !origins.has(origin)) {
        return jsonResponse(
          { error: "origin_not_allowed" },
          403,
          origin,
          origins,
        );
      }

      if (request.method === "OPTIONS") {
        const requestedMethod = request.headers.get(
          "access-control-request-method",
        );
        const requestedHeaders =
          (request.headers.get("access-control-request-headers") ?? "")
            .split(",").map((header) => header.trim().toLowerCase()).filter(
              Boolean,
            );
        if (
          !origin || requestedMethod !== "POST" ||
          requestedHeaders.some((header) => !allowedRequestHeaders.has(header))
        ) {
          headers.set("Content-Type", "application/json; charset=utf-8");
          return new Response(JSON.stringify({ error: "invalid_preflight" }), {
            status: 400,
            headers,
          });
        }
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== "POST") {
        return jsonResponse(
          { error: "method_not_allowed" },
          405,
          origin,
          origins,
        );
      }

      const url = dependencies.env("SUPABASE_URL");
      const serviceRoleKey = dependencies.env("SUPABASE_SERVICE_ROLE_KEY");
      const cardHmacKey = dependencies.env("CARD_IDENTIFIER_HMAC_KEY");
      if (!url || !serviceRoleKey || !cardHmacKey) {
        return jsonResponse(
          { error: "server_configuration_error" },
          500,
          origin,
          origins,
        );
      }

      const deviceCredential = request.headers.get("x-device-credential") ?? "";
      if (deviceCredential.length < 32 || deviceCredential.length > 256) {
        return jsonResponse({ error: "unauthorized" }, 401, origin, origins);
      }
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = await request.json();
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("invalid object");
        }
        body = parsed as Record<string, unknown>;
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400, origin, origins);
      }

      const schoolId = typeof body.school_id === "string" ? body.school_id : "";
      const deviceId = typeof body.device_id === "string" ? body.device_id : "";
      const cardIdentifier = typeof body.card_identifier === "string"
        ? body.card_identifier.trim()
        : "";
      const idempotencyKey = typeof body.idempotency_key === "string"
        ? body.idempotency_key
        : "";
      const direction = body.direction === "in" || body.direction === "out"
        ? body.direction
        : "";
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (
        !uuid.test(schoolId) || !uuid.test(deviceId) ||
        !uuid.test(idempotencyKey) || !cardIdentifier ||
        cardIdentifier.length > 512 || !direction
      ) {
        return jsonResponse(
          { error: "invalid_scan_request" },
          400,
          origin,
          origins,
        );
      }

      const [deviceDigest, cardDigest] = await Promise.all([
        sha256(deviceCredential),
        hmacSha256(cardHmacKey, cardIdentifier),
      ]);
      const admin = dependencies.createAdminClient(url, serviceRoleKey);
      const { data: eventId, error: scanError } = await admin.rpc(
        "process_attendance_scan",
        {
          p_school_id: schoolId,
          p_device_id: deviceId,
          p_device_credential_digest: `\\x${toHex(deviceDigest)}`,
          p_identifier_digest: `\\x${toHex(cardDigest)}`,
          p_idempotency_key: idempotencyKey,
          p_scan_direction: direction,
        },
      );
      if (scanError || typeof eventId !== "string" || !uuid.test(eventId)) {
        return jsonResponse(
          { error: "scan_not_authorized" },
          403,
          origin,
          origins,
        );
      }

      const { data: outcomeRows, error: outcomeError } = await admin.rpc(
        "get_attendance_scan_outcome",
        {
          p_scan_event_id: eventId,
        },
      );
      if (
        outcomeError || !Array.isArray(outcomeRows) || outcomeRows.length !== 1
      ) {
        return jsonResponse(
          { error: "scan_outcome_unavailable" },
          500,
          origin,
          origins,
        );
      }
      const result = outcomeRows[0] as Record<string, unknown>;
      if (
        result.scan_event_id !== eventId ||
        typeof result.outcome !== "string" || !outcomes.has(result.outcome) ||
        (result.rejection_code !== null &&
          (typeof result.rejection_code !== "string" ||
            !rejectionCodes.has(result.rejection_code)))
      ) {
        return jsonResponse(
          { error: "scan_outcome_invalid" },
          500,
          origin,
          origins,
        );
      }

      return jsonResponse(
        {
          scan_event_id: eventId,
          outcome: result.outcome,
          rejection_code: result.rejection_code,
        },
        200,
        origin,
        origins,
      );
    } catch {
      return jsonResponse(
        { error: "scan_processing_failed" },
        500,
        origin,
        origins,
      );
    }
  };
}

if (import.meta.main) {
  const dependencies: HandlerDependencies = {
    env: (name) => Deno.env.get(name),
    createAdminClient: (url, key) =>
      createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as ScanRpcClient,
  };
  Deno.serve(createScanHandler(dependencies));
}
