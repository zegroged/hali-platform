import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/panel";
import { normalizePhone, isRealMobilePhone } from "@/lib/phone";
import { telefonKoduGonder } from "@/lib/phoneOtp";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

// İŞLETMENİN WHATSAPP NUMARASINI DOĞRULA — kod isteme adımı.
// İşletme kaydının kapısı E-POSTA'dır (sabit hatta OTP gitmez); WhatsApp
// numarası burada ayrıca doğrulanır. Numara işletmenin KENDİ kayıtlı
// numaralarından biri ve CEP olmalı.
const Body = z.object({ phone: z.string().min(10).max(20) });

export async function POST(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const rl = rateLimit(`wa-verify:${b.id}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Numara gerekli." }, { status: 400 });

  const hedef = normalizePhone(parsed.data.phone);
  // SAHİPLİK: yalnız işletmenin kendi numaralarından biri doğrulanabilir.
  const kendi = [b.phone, b.gsmPhone2].filter(Boolean).map((x) => normalizePhone(x!));
  if (!kendi.includes(hedef))
    return NextResponse.json(
      { error: "Bu numara işletmenize kayıtlı değil. Önce profilinize ekleyin." },
      { status: 400 },
    );
  if (!isRealMobilePhone(hedef))
    return NextResponse.json(
      { error: "WhatsApp doğrulaması için CEP numarası gerekir (sabit hat olmaz)." },
      { status: 400 },
    );

  const r = await telefonKoduGonder(hedef);
  if (!r.ok) return NextResponse.json({ error: r.hata }, { status: r.durum ?? 400 });
  return NextResponse.json({ ok: true });
}
