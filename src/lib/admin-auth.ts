import { cookies } from "next/headers";

const COOKIE_NAME = "nokool-admin-session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function generateToken(): string {
  const secret = process.env.ADMIN_SECRET ?? "fallback-secret";
  const timestamp = Date.now().toString(36);
  // Simple HMAC-like hash using Web Crypto isn't available synchronously,
  // so we use a basic hash that's good enough for single-admin auth
  let hash = 0;
  const input = `${secret}:${timestamp}`;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `${timestamp}.${Math.abs(hash).toString(36)}`;
}

function isValidToken(token: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [timestamp] = token.split(".");
  const created = parseInt(timestamp, 36);
  const now = Date.now();
  // Check if token is less than 24 hours old
  return now - created < MAX_AGE * 1000;
}

export function checkPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return password === adminPassword;
}

export function createSessionCookie(): {
  name: string;
  value: string;
  maxAge: number;
} {
  return {
    name: COOKIE_NAME,
    value: generateToken(),
    maxAge: MAX_AGE,
  };
}

export function isAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session) return false;
  return isValidToken(session.value);
}

export function isAuthenticatedFromValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return isValidToken(cookieValue);
}

export { COOKIE_NAME, MAX_AGE };
