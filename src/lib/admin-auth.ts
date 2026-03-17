import { cookies } from "next/headers";

const COOKIE_NAME = "nokool-admin-session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  return process.env.ADMIN_SECRET ?? "fallback-secret-change-me";
}

/**
 * Synchronous signature for session tokens.
 * Uses FNV-1a inspired hash with the server secret — edge-runtime compatible.
 */
function signPayload(data: string): string {
  const secret = getSecret();
  const input = `${secret}:${data}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

function generateToken(): string {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = Date.now().toString(36);
  const payload = `${id}.${timestamp}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function isValidToken(token: string): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  // Verify signature
  const expected = signPayload(payload);
  if (signature !== expected) return false;

  // Extract timestamp (last segment of payload before signature)
  const payloadParts = payload.split(".");
  if (payloadParts.length < 2) return false;
  const timestamp = payloadParts[payloadParts.length - 1];
  const created = parseInt(timestamp, 36);
  const now = Date.now();
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
