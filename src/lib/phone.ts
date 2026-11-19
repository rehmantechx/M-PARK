// Phone helpers with no Node imports, so client components can use them.
// Pakistani mobile numbers only. Stored in the database as +92xxxxxxxxxx.
export function normalizePhone(raw: string): string {
  const p = String(raw || "").trim().replace(/[\s()-]/g, "");
  if (p.startsWith("+92")) return p;
  if (p.startsWith("92") && p.length === 12) return `+${p}`;
  if (p.startsWith("0") && p.length === 11) return `+92${p.slice(1)}`;
  return p;
}

export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^\+92\d{10}$/.test(p);
}

export function phoneVariants(raw: string): string[] {
  const n = normalizePhone(raw);
  const out = [n];
  // Seed data stores phones spaced like "+92 300 1234567".
  if (/^\+92\d{10}$/.test(n)) {
    out.push(`+92 ${n.slice(3, 6)} ${n.slice(6)}`);
    out.push(`0${n.slice(3)}`);
    out.push(n.slice(3));
  }
  return [...new Set(out)];
}
