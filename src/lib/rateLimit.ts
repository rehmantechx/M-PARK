// Simple in-memory rate limit. Good enough for a single-server dashboard.
// Each key gets max attempts in the window, then 429 until the window ends.
// The map is pruned on every call and capped, so it cannot grow without
// bound from many distinct keys. On a multi-server deployment this must
// move to a shared store such as Redis, because each server counts alone.
const hits = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 1000;

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  for (const [k, rec] of hits) {
    if (rec.resetAt < now) hits.delete(k);
  }
  if (hits.size >= MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  const rec = hits.get(key);
  if (!rec || rec.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}
