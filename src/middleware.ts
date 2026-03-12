import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedFromValue, COOKIE_NAME } from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Protect admin pages (except login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Protect write operations on API routes
  if (
    (pathname.startsWith("/api/politicians") || pathname.startsWith("/api/bills") || pathname.startsWith("/api/donors")) &&
    ["POST", "PUT", "DELETE"].includes(method)
  ) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!isAuthenticatedFromValue(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/politicians/:path*", "/api/bills/:path*", "/api/donors/:path*"],
};
