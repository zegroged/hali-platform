import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { normalizeCityName, normalizeDistrictName } from "@/lib/cities";

// Boş şehir/ilçe sayfasındaki "açılınca haber ver" kaydı. E-posta yalnız bu
// bilgilendirme amacıyla saklanır (KVKK notu formda). İl başına aynı e-posta
// bir kez tutulur (upsert) — tekrar gönderim hata değildir.
const Body = z.object({
  city: z.string().trim().min(2).max(40),
  district: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120),
  // Honeypot: gerçek kullanıcı bu gizli alanı doldurmaz.
  website: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`city-lead:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }
  if (parsed.data.website) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const city = normalizeCityName(parsed.data.city);
  if (!city) {
    return NextResponse.json({ error: "Geçersiz şehir." }, { status: 400 });
  }
  const district = parsed.data.district
    ? normalizeDistrictName(city, parsed.data.district)
    : null;
  const email = parsed.data.email.toLowerCase();

  await prisma.cityLead.upsert({
    where: { city_email: { city, email } },
    update: { district }, // aynı il için son gelen ilçe bilgisini tut
    create: { city, district, email },
  });

  return NextResponse.json({ ok: true });
}
