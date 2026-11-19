import { createHash, randomInt } from "crypto";
import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { normalizePhone, safeEqual } from "@/lib/validate";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function createOtp(rawPhone: string, purpose: string) {
  const phone = normalizePhone(rawPhone);
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  // Invalidate older unverified codes for this phone and purpose, so only
  // the newest code can be used and a stuck 5-attempt record cannot block it.
  await db.otpCode.updateMany({ where: { phone, purpose, verified: false }, data: { verified: true } });
  await db.otpCode.create({ data: { phone, purpose, codeHash: hashCode(code), expiresAt } });
  const sms = await sendSms(phone, `Your M-Park OTP is ${code}. It expires in 10 minutes.`);
  // Dev code is returned only in local development, never in production.
  const isDev = process.env.NODE_ENV === "development" && !process.env.SMS_PROVIDER;
  if (!sms.sent && !isDev) return { ok: false, smsSent: false, provider: sms.provider, note: sms.note, devCode: undefined };
  return { ok: true, smsSent: sms.sent, provider: sms.provider, note: sms.note, devCode: isDev ? code : undefined };
}

export async function verifyOtp(rawPhone: string, purpose: string, code: string) {
  const phone = normalizePhone(rawPhone);
  const records = await db.otpCode.findMany({
    where: { phone, purpose, verified: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (records.length === 0) return { ok: false, error: "No OTP was requested for this number. Request a new code." };
  const now = new Date();
  for (const record of records) {
    if (record.expiresAt < now) continue;
    if (record.attempts >= 5) continue;
    if (safeEqual(record.codeHash, hashCode(code.trim()))) {
      await db.otpCode.update({ where: { id: record.id }, data: { verified: true } });
      return { ok: true };
    }
    await db.otpCode.update({ where: { id: record.id }, data: { attempts: record.attempts + 1 } });
  }
  const anyExpired = records.some((r) => r.expiresAt < now);
  const anyLocked = records.some((r) => r.attempts >= 5);
  if (anyLocked && !records.some((r) => r.expiresAt >= now && r.attempts < 5)) return { ok: false, error: "Too many wrong attempts. Request a new code." };
  if (anyExpired) return { ok: false, error: "OTP has expired. Request a new code." };
  return { ok: false, error: "Wrong OTP. Try again." };
}
