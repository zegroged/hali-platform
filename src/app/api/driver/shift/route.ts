import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const u = await getAuthedUser();
  if (!u || u.role !== "DRIVER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const on = Boolean(body?.on);

  const driver = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!driver) {
    return NextResponse.json({ error: "Şoför yok" }, { status: 404 });
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: {
      isOnShift: on,
      // Mesai AÇILIŞ anı — konum bekçisinin referansı (lib/konumBekcisi.ts).
      // Kapanışta null: kapalı mesai için sessizlik ölçmenin anlamı yok.
      shiftStartedAt: on ? new Date() : null,
      // 🔴 `lastSeenAt: new Date()` BURADAN KALDIRILDI (2026-08-08, DENETİM md.8d).
      //
      // Mesai açılışı `lastSeenAt`i tazeliyor ama `lastLat/lastLng`e
      // DOKUNMUYORDU. Oysa bütün tazelik korumaları (panel 5 dk, müşteri
      // takibi 10 dk) "lastSeenAt = son KONUMUN anı" varsayıyor. Sonuç:
      // şoför mesaiyi kapatıp açtığı an, GÜNLER ÖNCEKİ koordinatı "canlı"
      // sayılıp haritada işaretçi olarak çiziliyordu.
      // Canlı kanıt: `osmansofor` — lastLat 22 Temmuz'dan, isOnShift=true.
      //
      // Artık `lastSeenAt`i YALNIZ gerçek ping yazıyor
      // (`api/driver/location`), yani alan adı ne diyorsa onu tutuyor.
    },
  });

  // Yeni mesai (ya da kapanış) = temiz sayfa: önceki mesaiden kalan "konum
  // gelmiyor" işareti taşınmasın, yoksa akış sağlıklı başlasa bile bekçi
  // "düzeldi" bildirimi göndermeye çalışır.
  await (await import("@/lib/konumBekcisi")).konumUyariIsaretiniSil(driver.id);

  // mesai biterken açık durağı kapat
  if (!on) {
    await prisma.driverStop.updateMany({
      where: { driverId: driver.id, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, on });
}
