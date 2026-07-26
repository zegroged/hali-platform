import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { normalizePhone } from "@/lib/phone";
import { telefonKoduDogrula } from "@/lib/phoneOtp";

// WhatsApp numarası doğrulama — kod onayı. Doğrulanan numara işletme kaydına
// yazılır; numara sonradan değişirse doğrulama otomatik düşer (whatsappNumber
// artık eşleşmez).
const Body = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().trim().length(6),
});

export async function POST(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Kod gerekli." }, { status: 400 });

  const hedef = normalizePhone(parsed.data.phone);
  const kendi = [b.phone, b.gsmPhone2].filter(Boolean).map((x) => normalizePhone(x!));
  if (!kendi.includes(hedef))
    return NextResponse.json({ error: "Numara işletmenize kayıtlı değil." }, { status: 400 });

  const r = await telefonKoduDogrula(hedef, parsed.data.code);
  if (!r.ok) return NextResponse.json({ error: r.hata }, { status: r.durum ?? 400 });

  await prisma.cleanerBusiness.update({
    where: { id: b.id },
    data: { whatsappNumber: hedef, whatsappVerifiedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
