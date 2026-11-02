export type SupabaseEnvironment = Record<string, string | undefined>;

export type SupabasePublicConfig = {
  url: string;
  key: string;
  keySource: "publishable" | "legacy-anon";
};

export type SupabaseConfigCheck = {
  configured: boolean;
  missing: string[];
  errors: string[];
  keySource: SupabasePublicConfig["keySource"] | null;
};

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isServiceRoleJwt(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload)) as { role?: unknown };
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}

export function checkSupabaseConfiguration(
  overrideEnv?: SupabaseEnvironment,
): SupabaseConfigCheck {
  const url = (overrideEnv?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim() ?? "";
  const publishableKey = (overrideEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim() ?? "";
  const legacyAnonKey = (overrideEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim() ?? "";
  const key = publishableKey || legacyAnonKey;
  const keySource = publishableKey
    ? "publishable"
    : legacyAnonKey
      ? "legacy-anon"
      : null;
  const missing: string[] = [];
  const errors: string[] = [];

  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && isLocalhost(parsed.hostname))
      ) {
        errors.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS (HTTP is allowed for localhost).");
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
    }
  }

  if (key && (key.startsWith("sb_secret_") || isServiceRoleJwt(key))) {
    errors.push(
      "A server-only Supabase key was supplied as a public key. Use a publishable or anon key here.",
    );
  }

  return {
    configured: missing.length === 0 && errors.length === 0,
    missing,
    errors: errors.map((error) => error.trim()),
    keySource,
  };
}

export function getSupabasePublicConfig(
  overrideEnv?: SupabaseEnvironment,
): SupabasePublicConfig {
  const check = checkSupabaseConfiguration(overrideEnv);
  if (!check.configured || !check.keySource) {
    const details = [...check.missing, ...check.errors].join(" ");
    throw new Error(`Supabase public configuration is invalid. ${details}`);
  }

  const url = (overrideEnv?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!.trim();
  const key = check.keySource === "publishable"
    ? (overrideEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!.trim()
    : (overrideEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim();

  return {
    url,
    key,
    keySource: check.keySource,
  };
}
