import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedFromValue, COOKIE_NAME } from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Allow all GET requests to API routes (public read access)
  if (pathname.startsWith("/api/") && method === "GET") {
    return NextResponse.next();
  }

  // Allow admin login page and auth API routes
  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout"
  ) {
    return NextResponse.next();
  }

  // Allow search API for all methods
  if (pathname === "/api/search") {
    return NextResponse.next();
  }

  // Protect admin pages — require session cookie
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Protect write operations (POST/PUT/DELETE) on API routes
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
    "/api/politicians/:path*",
    "/api/bills/:path*",
    "/api/donors/:path*",
    "/api/search",
  ],
};
