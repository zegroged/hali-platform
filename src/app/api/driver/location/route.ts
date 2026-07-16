import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
import { evaluateStop } from "@/lib/tracking";
import { maybePrunePings } from "@/lib/retention";
import { trYearMonth } from "@/lib/time";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { haversineKm } from "@/lib/geo";

// Kayma süzgeçleri: GPS oturmadan gelen kaba konum (Wi-Fi/baz, yüzlerce metre
// sapar) ve fiziksel olarak imkânsız sıçramalar KAYDEDİLMEZ — haritada
// "gitmediği yeri gitmiş göster" izlerinin köküydü.
const MAX_ACCURACY_M = 150; // bundan kaba fix'ler çöp
const TELEPORT_WINDOW_SEC = 120; // yalnız taze önceki ping'e karşı bak (yapışma olmasın)
const TELEPORT_SPEED_MPS = 50; // ~180 km/sa üstü = ışınlanma, at

// Şoför konum gönderir; her konumda stay-point durak tespiti çalışır.
export async function POST(req: NextRequest) {
  const u = await getAuthedUser();
  if (!u || u.role !== "DRIVER") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  // Ping seli koruması: normal izleme ~15 sn'de bir; şoför başına 60/dk yeter.
  const rl = rateLimit(`loc:${u.id}`, 60, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json({ error: "Geçersiz konum" }, { status: 400 });
  }
  // Opsiyonel hassasiyet (metre): eski istemciler göndermez → süzgeç atlanır.
  const acc = body?.acc == null ? null : Number(body.acc);
  if (acc != null && Number.isFinite(acc) && acc > MAX_ACCURACY_M) {
    return NextResponse.json({ ok: true, skipped: "accuracy" });
  }

  const driver = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!driver) {
    return NextResponse.json({ error: "Şoför yok" }, { status: 404 });
  }

  try {
  const now = new Date();
  const last = await prisma.driverLocationPing.findFirst({
    where: { driverId: driver.id },
    orderBy: { recordedAt: "desc" },
  });

  // Işınlanma süzgeci: taze bir önceki ping varken imkânsız hız = sapmış fix.
  // Eski ping'e karşı bakılmaz — yanlış kayıt sonrası doğru konuma "yapışıp"
  // her yeni fix'i reddetme durumu oluşmasın.
  if (last) {
    const dtSec = (now.getTime() - last.recordedAt.getTime()) / 1000;
    if (dtSec >= 0 && dtSec < TELEPORT_WINDOW_SEC) {
      const distM = haversineKm(last.lat, last.lng, lat, lng) * 1000;
      if (distM / Math.max(dtSec, 1) > TELEPORT_SPEED_MPS) {
        return NextResponse.json({ ok: true, skipped: "teleport" });
      }
    }
  }

  await prisma.$transaction([
    prisma.driver.update({
      where: { id: driver.id },
      data: { lastLat: lat, lastLng: lng, lastSeenAt: now },
    }),
    prisma.driverLocationPing.create({
      data: { driverId: driver.id, lat, lng },
    }),
  ]);

  const openStop = await prisma.driverStop.findFirst({
    where: { driverId: driver.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const action = evaluateStop({
    openStop: openStop
      ? { lat: openStop.lat, lng: openStop.lng, startedAt: openStop.startedAt }
      : null,
    lastPing: last
      ? { lat: last.lat, lng: last.lng, recordedAt: last.recordedAt }
      : null,
    lat,
    lng,
    now,
  });

  if (action.type === "open") {
    const period = trYearMonth(action.startedAt); // TR ayına yaz (A9)
    await prisma.driverStop.create({
      data: {
        driverId: driver.id,
        lat: action.lat,
        lng: action.lng,
        startedAt: action.startedAt,
        durationSec: 0, // yeni durak sıfırdan başlar; extend doğru hesaplar (D5)
        periodYear: period.year,
        periodMonth: period.month,
      },
    });
  } else if (action.type === "extend" && openStop) {
    await prisma.driverStop.update({
      where: { id: openStop.id },
      data: { durationSec: action.durationSec },
    });
  } else if (action.type === "finalize" && openStop) {
    await prisma.driverStop.update({
      where: { id: openStop.id },
      data: { endedAt: action.endedAt, durationSec: action.durationSec },
    });
  } else if (action.type === "discard" && openStop) {
    await prisma.driverStop.delete({ where: { id: openStop.id } });
  }

  // Eski ping'leri ara sıra temizle (sınırsız büyümeyi engelle) — yanıtı bekletme.
  void maybePrunePings();

  return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("driver/location hatası:", e);
    return NextResponse.json({ error: "Konum kaydedilemedi" }, { status: 500 });
  }
}
