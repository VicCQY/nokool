import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedFromValue, COOKIE_NAME } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitResponse(result: { resetAt: number }) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    },
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const ip = getClientIp(request);

  // Anyone hitting /admin gets a 404 — not a redirect
  if (pathname.startsWith("/admin")) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  // Allow all GET requests to API routes (public read access)
  if (pathname.startsWith("/api/") && method === "GET") {
    // Rate limit public API reads: 60/min per IP
    const rl = checkRateLimit(`public:${ip}`, 60);
    if (!rl.allowed) return rateLimitResponse(rl);
    return NextResponse.next();
  }

  // Allow admin login page and auth API routes
  if (
    pathname === "/nk-manage/login" ||
    pathname === "/api/nk-manage/login" ||
    pathname === "/api/nk-manage/logout"
  ) {
    // Rate limit login: 5 attempts/min per IP
    if (pathname === "/api/nk-manage/login" && method === "POST") {
      const rl = checkRateLimit(`login:${ip}`, 5);
      if (!rl.allowed) return rateLimitResponse(rl);
    }
    return NextResponse.next();
  }

  // Allow search API for all methods
  if (pathname === "/api/search") {
    const rl = checkRateLimit(`public:${ip}`, 60);
    if (!rl.allowed) return rateLimitResponse(rl);
    return NextResponse.next();
  }

  // Protect admin pages — require session cookie
  if (pathname.startsWith("/nk-manage")) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.redirect(new URL("/nk-manage/login", request.url));
    }
    return NextResponse.next();
  }

  // Protect admin API routes (import, clear-data, etc.)
  if (pathname.startsWith("/api/nk-manage")) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Rate limit admin API: 30/min per IP
    const rl = checkRateLimit(`admin:${ip}`, 30);
    if (!rl.allowed) return rateLimitResponse(rl);
    return NextResponse.next();
  }

  // Protect write operations (POST/PUT/DELETE) on public API routes
  if (
    (pathname.startsWith("/api/politicians") ||
      pathname.startsWith("/api/bills") ||
      pathname.startsWith("/api/donors")) &&
    ["POST", "PUT", "DELETE"].includes(method)
  ) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Everything else is public
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/nk-manage/:path*",
    "/api/politicians/:path*",
    "/api/bills/:path*",
    "/api/donors/:path*",
    "/api/nk-manage/:path*",
    "/api/search",
  ],
};
