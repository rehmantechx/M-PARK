import { timingSafeEqual } from "crypto";
import { isValidPhone, normalizePhone, phoneVariants } from "@/lib/phone";

export { isValidPhone, normalizePhone, phoneVariants };

// Shared validation for every dashboard form and API route.
// All helpers return null when the value is valid, or a clear message.

export function phoneError(raw: string): string | null {
  if (!raw || !String(raw).trim()) return "Phone number is required.";
  if (!isValidPhone(raw)) return "Enter a valid Pakistani mobile number, for example +92 300 1234567.";
  return null;
}

export function isValidPlate(raw: string): boolean {
  const p = String(raw || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9 -]{2,14}$/.test(p);
}

export function parseIntStrict(raw: unknown, field: string): { value: number | null; error: string | null } {
  if (raw === null || raw === undefined || String(raw).trim() === "") return { value: null, error: `${field} is required.` };
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) return { value: null, error: `${field} must be a whole number.` };
  return { value: Number(s), error: null };
}

export function parseYear(raw: unknown): { value: number | null; error: string | null } {
  const r = parseIntStrict(raw, "Year");
  if (r.error || r.value === null) return r;
  const maxYear = new Date().getFullYear() + 1;
  if (r.value < 1900 || r.value > maxYear) return { value: null, error: `Year must be between 1900 and ${maxYear}.` };
  return r;
}

export function parseMoney(raw: unknown, field: string): { value: number | null; error: string | null } {
  const r = parseIntStrict(raw, field);
  if (r.error || r.value === null) return r;
  if (r.value <= 0) return { value: null, error: `${field} must be above 0.` };
  if (r.value > 100000000) return { value: null, error: `${field} is too large.` };
  return r;
}

export function requiredText(raw: unknown, field: string, max = 100): string | null {
  const s = String(raw || "").trim();
  if (!s) return `${field} is required.`;
  if (s.length > max) return `${field} must be ${max} characters or less.`;
  return null;
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function formatPkr(n: number): string {
  return `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
}

export function isActiveSubscription(sub: { status: string; endDate: Date } | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === "ACTIVE" && new Date(sub.endDate) > new Date();
}
