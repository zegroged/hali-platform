import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { telefonKoduGonder, phoneOtpRequired } from "@/lib/phoneOtp";

// Arayüzün "telefon doğrulama adımını göstereyim mi" sorusunun cevabı.
// Bayrak sunucuda; istemci build'e gömülmesin diye uçtan okunur — böylece
// .env değişince YENİDEN DERLEME GEREKMEZ, konteyner yeniden başlaması yeter.
export async function GET() {
  return NextResponse.json({ required: phoneOtpRequired });
}

// Kayıt öncesi telefon doğrulama kodu isteme (müşteri üyeliği).
// Kod WhatsApp'tan gider; WhatsApp kapalıysa 503 döner ve kayıt akışı
// doğrulamayı ATLAR (bkz. customer-register).
const Body = z.object({ phone: z.string().min(10).max(20) });

export async function POST(req: NextRequest) {
  // Kötüye kullanım freni: IP başına saatte 5 kod isteği (mesaj başına ücret var).
  const rl = rateLimit(`phoneotp:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Telefon gerekli." }, { status: 400 });

  const r = await telefonKoduGonder(parsed.data.phone);
  if (!r.ok)
    return NextResponse.json({ error: r.hata }, { status: r.durum ?? 400 });
  return NextResponse.json({ ok: true });
}
