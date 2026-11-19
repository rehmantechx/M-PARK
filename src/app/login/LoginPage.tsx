"use client";

import { useState } from "react";
import Link from "next/link";

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

  async function adminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!data.ok) { setError(data.error || "Login failed."); return; }
    window.location.href = "/admin";
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setDevCode("");
    const res = await fetch("/api/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, purpose: "login" }) });
    const data = await res.json();
    if (!data.ok) { setError(data.error || "Could not send OTP."); return; }
    setStep("otp");
    if (data.devCode) { setDevCode(String(data.devCode)); setInfo("Dev mode only: no SMS provider is configured yet, so your OTP is shown here. In production it will arrive by SMS."); }
    else setInfo("OTP sent by SMS. Enter it below.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/otp/verify-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
    const data = await res.json();
    if (!data.ok) { setError(data.error || "OTP failed."); return; }
    window.location.href = "/customer";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mt-3">Login to M-Park</h1>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setRole("customer")} className={role === "customer" ? "btn-primary flex-1" : "btn-secondary flex-1"}>Customer</button>
          <button onClick={() => setRole("admin")} className={role === "admin" ? "btn-primary flex-1" : "btn-secondary flex-1"}>Admin</button>
        </div>
        {error && <p className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mt-4 text-sm">{error}</p>}
        {info && <p className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-3 py-2 mt-4 text-sm">{info}</p>}
        {devCode && <p className="bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-sm">Dev OTP only: <strong>{devCode}</strong></p>}
        {role === "admin" ? (
          <form onSubmit={adminLogin} className="mt-5 space-y-4">
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@m-park.example" required /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <button className="btn-primary w-full" type="submit">Login as admin</button>
            <p className="text-slate-500 text-xs">Seeded admin for testing: admin@m-park.example / Admin1234! Change this password before launch.</p>
          </form>
        ) : step === "phone" ? (
          <form onSubmit={requestOtp} className="mt-5 space-y-4">
            <div><label className="label">Mobile number</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 0000000" required /></div>
            <button className="btn-primary w-full" type="submit">Send OTP</button>
            <p className="text-slate-500 text-sm">No account yet? Registration is handled by the public registration page, built by the frontend team using the /api/register endpoint.</p>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-5 space-y-4">
            <div><label className="label">OTP sent to {phone}</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 digit code" required /></div>
            <button className="btn-primary w-full" type="submit">Verify and login</button>
            <button type="button" className="btn-secondary w-full" onClick={() => setStep("phone")}>Use a different number</button>
          </form>
        )}
      </div>
    </main>
  );
}
