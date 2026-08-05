import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// TELEFON BİLDİRİM JETONU KAYDI (2026-08-05).
//
// Uygulama açılışta/girişte Expo'dan bir jeton alır ve buraya gönderir.
// Sunucu `notify()` çağrıldığında bu jetonlara push atar (lib/push.ts).
//
// 🔴 JETON CİHAZA AİT, KULLANICIYA DEĞİL: dükkânda ortak telefon kullanılırsa
// (halıcı girer, sonra şoför girer) aynı jeton iki kullanıcıya bağlanabilirdi.
// O yüzden `token` @unique ve burada UPSERT ile SAHİBİ GÜNCELLENİYOR —
// telefonda en son kim giriş yaptıysa bildirimler ona gider. Aksi hâlde
// dükkândan ayrılmış bir çalışan işletmenin siparişlerini görmeye devam ederdi.

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z
    .string()
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Jeton biçimi geçersiz."),
  platform: z.enum(["android", "ios"]).default("android"),
});

export async function POST(req: NextRequest) {
  // Çerez (panel) veya Bearer (uygulama) — ikisi de kabul.
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const rl = rateLimit(`push-kayit:${u.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" },
      { status: 400 },
    );
  }

  const { token, platform } = parsed.data;
  try {
    await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform, userId: u.id },
      // Sahip değiştiyse devret + son görülmeyi tazele.
      update: { userId: u.id, platform, lastSeenAt: new Date() },
    });
  } catch (e) {
    console.error("[push] jeton kaydedilemedi:", e);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Çıkışta jetonu düşür — telefon başkasının eline geçerse bildirim gitmesin. */
export async function DELETE(req: NextRequest) {
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const parsed = Body.pick({ token: true }).safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return NextResponse.json({ ok: true });
  // Yalnız KENDİ jetonunu silebilir.
  await prisma.pushToken
    .deleteMany({ where: { token: parsed.data.token, userId: u.id } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
