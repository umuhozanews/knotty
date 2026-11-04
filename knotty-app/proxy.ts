import { NextRequest, NextResponse } from "next/server";

function isPhone(ua: string): boolean {
  const lc = (ua ?? "").toLowerCase();
  if (!lc) return false;
  if (lc.includes("ipad")) return false;
  // Android tablets send "Android" but not "Mobile"
  if (lc.includes("android") && !lc.includes("mobile")) return false;
  return /iphone|ipod|android.*mobile|windows phone|blackberry/.test(lc);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";
  const phone = isPhone(ua);

  // Desktop requesting /mobile/* → back to home
  if (!phone && pathname.startsWith("/mobile")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Phone requesting / → mobile router
  if (phone && pathname === "/") {
    return NextResponse.redirect(new URL("/mobile", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/mobile", "/mobile/:path*"],
};
