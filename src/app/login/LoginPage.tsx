"use client";

import { useState } from "react";
import { normalizePhone } from "@/lib/phone";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ ok: false, error: "Server did not respond. Please try again." }));
  if (!res.ok && !data.error) data.error = "Server did not respond. Please try again.";
  return data as { ok: boolean; error?: string; devCode?: string; smsSent?: boolean; note?: string };
}

export default function LoginPage({ initialRole }: { initialRole: string }) {
  const [role, setRole] = useState(initialRole === "admin" ? "admin" : "customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);

  function switchRole(next: "customer" | "admin") {
    setRole(next);
    setStep("phone");
    setError("");
    setInfo("");
    setDevCode("");
    setCode("");
  }

  async function adminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await postJson("/api/auth/admin-login", { email, password });
      if (!data.ok) { setError(data.error || "Login failed."); return; }
      window.location.href = "/admin";
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function requestOtp(e: React.FormEvent, resend = false) {
    e.preventDefault();
    setError(""); setInfo(""); setDevCode("");
    const normalized = normalizePhone(phone);
    if (!/^\+92\d{10}$/.test(normalized)) { setError("Enter a valid Pakistani mobile number, for example +92 300 1234567."); return; }
    setBusy(true);
    try {
      const data = await postJson("/api/otp/request", { phone: normalized, purpose: "login" });
      if (!data.ok) { setError(data.error || "Could not send OTP."); return; }
      setPhone(normalized);
      setStep("otp");
      setCode("");
      if (data.devCode) { setDevCode(String(data.devCode)); setInfo("Dev mode only: no SMS provider is configured yet, so your OTP is shown here. In production it will arrive by SMS."); }
      else setInfo(resend ? "A new OTP was sent by SMS." : "OTP sent by SMS. Enter it below.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6 digit OTP code."); return; }
    setBusy(true);
    try {
      const data = await postJson("/api/otp/verify-customer", { phone, code });
      if (!data.ok) { setError(data.error || "OTP failed."); return; }
      window.location.href = "/customer";
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mt-3">Login to M-Park</h1>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => switchRole("customer")} className={role === "customer" ? "btn-primary flex-1" : "btn-secondary flex-1"}>Customer</button>
          <button type="button" onClick={() => switchRole("admin")} className={role === "admin" ? "btn-primary flex-1" : "btn-secondary flex-1"}>Admin</button>
        </div>
        {error ? <p role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mt-4 text-sm">{error}</p> : null}
        {info ? <p role="status" className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-3 py-2 mt-4 text-sm">{info}</p> : null}
        {devCode ? <p className="bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-sm">Dev OTP only: <strong>{devCode}</strong></p> : null}
        {role === "admin" ? (
          <form onSubmit={adminLogin} className="mt-5 space-y-4">
            <div><label className="label" htmlFor="admin-email">Email</label><input id="admin-email" className="input" type="email" maxLength={100} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@m-park.example" required /></div>
            <div><label className="label" htmlFor="admin-password">Password</label><input id="admin-password" className="input" type="password" maxLength={100} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Logging in..." : "Login as admin"}</button>
          </form>
        ) : step === "phone" ? (
          <form onSubmit={(e) => requestOtp(e)} className="mt-5 space-y-4">
            <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" className="input" type="tel" inputMode="tel" maxLength={15} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 0000000" required /></div>
            <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Sending..." : "Send OTP"}</button>
            <p className="text-slate-500 text-sm">No account yet? Ask the admin to register your vehicle, or use the registration page built by the frontend team.</p>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-5 space-y-4">
            <div><label className="label" htmlFor="otp-code">OTP sent to {phone}</label><input id="otp-code" className="input" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit code" required /></div>
            <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify and login"}</button>
            <button type="button" className="btn-secondary w-full" disabled={busy} onClick={(e) => requestOtp(e, true)}>Resend OTP</button>
            <button type="button" className="btn-secondary w-full" onClick={() => { setStep("phone"); setCode(""); setError(""); setDevCode(""); }}>Use a different number</button>
          </form>
        )}
      </div>
    </main>
  );
}
