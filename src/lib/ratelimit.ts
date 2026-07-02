// Basit in-memory rate limiter (sabit pencere). TEK instance için yeterlidir.
// ÇOK-instance / yatay ölçekte paylaşımlı bir store'a (Redis/Upstash) taşı —
// aksi halde her instance kendi sayacını tutar ve limit gevşer.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}

export type RateResult = { ok: boolean; retryAfterSec: number; remaining: number };

/** key için windowMs içinde en fazla `limit` istek. Aşılırsa ok=false. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  b.count++;
  return { ok: true, retryAfterSec: 0, remaining: limit - b.count };
}

/** İstek IP'si (ters proxy arkasında x-forwarded-for ilk değer). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 429 yanıtı (Retry-After başlığıyla). */
export function tooMany(retryAfterSec: number) {
  return new Response(
    JSON.stringify({ error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, retryAfterSec)),
      },
    },
  );
}
