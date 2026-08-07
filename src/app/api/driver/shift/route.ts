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
      ...(on ? { lastSeenAt: new Date() } : {}),
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
