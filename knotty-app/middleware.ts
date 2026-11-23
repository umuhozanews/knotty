import { NextRequest, NextResponse } from "next/server";

// Per-edge-instance sliding window rate limiter
// Provides basic abuse protection; not globally distributed (each Vercel edge node has its own state)
const store = new Map<string, { count: number; windowStart: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/login":       { max: 10, windowMs: 60_000 },      // 10 attempts / minute / IP
  "/api/schools/register": { max: 3,  windowMs: 3_600_000 },   // 3 registrations / hour / IP
};

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const limit = LIMITS[pathname];
  if (!limit) return NextResponse.next();

  const key = `${clientIp(req)}:${pathname}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > limit.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    // Prune stale entries periodically to prevent unbounded memory growth
    if (store.size > 5000) {
      for (const [k, v] of store) {
        if (now - v.windowStart > limit.windowMs) store.delete(k);
      }
    }
    return NextResponse.next();
  }

  if (entry.count >= limit.max) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.windowMs - (now - entry.windowStart)) / 1000)) } }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/login", "/api/schools/register"],
};
