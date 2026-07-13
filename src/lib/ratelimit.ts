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

/**
 * Gerçek istemci IP'si. Cloudflare arkasındayız: CF-Connecting-IP'yi Cloudflare
 * kendisi set eder ve istemcinin gönderdiğini EZER — güvenilir tek kaynak budur.
 * X-Forwarded-For'un EN SOLU istemci tarafından uydurulabilir (nginx/CF sağa
 * ekler), o yüzden onu kullanmak rate-limit'i tamamen atlatır (denetim bulgusu).
 * XFF yalnız CF-Connecting-IP yoksa, en SAĞDAN (güvenilir peer'a en yakın) alınır.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // En sağdaki = zincirdeki son (bize en yakın, güvenilir) proxy'nin gördüğü IP.
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
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
