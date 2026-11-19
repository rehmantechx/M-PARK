"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span>
      <button
        className="block w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-green-900 disabled:opacity-50"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/auth/logout", { method: "POST" });
            if (!res.ok) throw new Error("Logout failed");
            window.location.href = "/login";
          } catch {
            setError("Logout failed. Please try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Logging out..." : "Logout"}
      </button>
      {error ? <span className="text-red-300 text-xs px-3">{error}</span> : null}
    </span>
  );
}
