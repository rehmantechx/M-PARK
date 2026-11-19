import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type SessionUser = { id: string; role: "ADMIN" | "CUSTOMER"; name: string; phone: string };

const COOKIE = "mpark_session";

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s) throw new Error("SESSION_SECRET is not set. Set a long random value in .env.");
    if (s.length < 32) throw new Error("SESSION_SECRET is too short. Use at least 32 random characters.");
  }
  return new TextEncoder().encode(s || "dev-only-change-me");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ sub: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = String(payload.sub || "");
    if (!id) return null;
    const user = await db.user.findUnique({ where: { id } });
    if (!user || user.isBlocked) return null;
    if (payload.role !== user.role) return null;
    return { id: user.id, role: user.role, name: user.name, phone: user.phone };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Admin login required");
  return s;
}

export async function requireCustomer(): Promise<SessionUser> {
  const s = await getSession();
  if (!s || s.role !== "CUSTOMER") throw new Error("Customer login required");
  return s;
}
