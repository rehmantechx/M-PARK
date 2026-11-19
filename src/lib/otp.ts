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
  // Delete older unverified codes for this phone and purpose, so only
  // the newest code can be used and a stuck 5-attempt record cannot block it.
  // Deleting is clearer than marking them verified, which would lie about
  // a code that was never used.
  await db.otpCode.deleteMany({ where: { phone, purpose, verified: false } });
  await db.otpCode.create({ data: { phone, purpose, codeHash: hashCode(code), expiresAt } });
  const sms = await sendSms(phone, `Your M-Park OTP is ${code}. It expires in 10 minutes.`);
  // Dev code is returned only in local development, never in production.
  const isDev = process.env.NODE_ENV === "development" && !process.env.SMS_PROVIDER;
  if (!sms.sent && !isDev) return { ok: false, smsSent: false, provider: sms.provider, note: sms.note, devCode: undefined };
  return { ok: true, smsSent: sms.sent, provider: sms.provider, note: sms.note, devCode: isDev ? code : undefined };
}

export async function verifyOtp(rawPhone: string, purpose: string, code: string) {
  const phone = normalizePhone(rawPhone);
  // Only one unverified code exists per phone and purpose, because
  // createOtp deletes older ones. Check only that record, and count a
  // wrong attempt against it alone, never against several records.
  const record = await db.otpCode.findFirst({
    where: { phone, purpose, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "No OTP was requested for this number. Request a new code." };
  const now = new Date();
  if (record.expiresAt < now) return { ok: false, error: "OTP has expired. Request a new code." };
  if (record.attempts >= 5) return { ok: false, error: "Too many wrong attempts. Request a new code." };
  if (safeEqual(record.codeHash, hashCode(code.trim()))) {
    await db.otpCode.update({ where: { id: record.id }, data: { verified: true } });
    return { ok: true };
  }
  await db.otpCode.update({ where: { id: record.id }, data: { attempts: record.attempts + 1 } });
  if (record.attempts + 1 >= 5) return { ok: false, error: "Too many wrong attempts. Request a new code." };
  return { ok: false, error: "Wrong OTP. Try again." };
}
