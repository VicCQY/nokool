import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionCookie } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password } = body;

  if (!checkPassword(password)) {
    return NextResponse.json(
      { error: "Wrong password. Try again." },
      { status: 401 },
    );
  }

  const cookie = createSessionCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });

  return response;
}
