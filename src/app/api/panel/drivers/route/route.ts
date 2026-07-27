import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { STOP_MIN_SEC } from "@/lib/tracking";
import { trDayBoundsUTC } from "@/lib/time";

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

// Bir şoförün belirli bir güne ait kayıtlı rotası (çizgi + duraklar + dakika)
export async function GET(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const driverId = sp.get("driverId");
  if (!driverId || !b.drivers.some((d) => d.id === driverId)) {
    return NextResponse.json({ error: "Şoför bulunamadı" }, { status: 404 });
  }

  const dateStr = sp.get("date"); // YYYY-MM-DD (TR günü)
  if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }
  const { start, end } = trDayBoundsUTC(dateStr ?? undefined);

  const [pings, stops] = await Promise.all([
    prisma.driverLocationPing.findMany({
      where: { driverId, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: "asc" },
      select: { lat: true, lng: true, recordedAt: true },
    }),
    prisma.driverStop.findMany({
      where: {
        driverId,
        startedAt: { gte: start, lt: end },
        durationSec: { gte: STOP_MIN_SEC }, // sadece gerçek duraklar
      },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  // BOŞSA NEDENİNİ SÖYLE (2026-07-27): eskiden yalnız "konum kaydı yok" yazıyordu
  // ve halıcı bunun sebebini (şoför mesaiye çıkmadı mı, uygulamayı hiç açmadı mı,
  // yanlış gün mü seçildi) anlayamıyordu. Teşhis için iki ek bilgi topluyoruz:
  // şoförün ŞU AN mesai durumu ve EN SON ne zaman konum gönderdiği.
  let tani: {
    hicKayitYok: boolean;
    sonKayit: string | null;
    mesaide: boolean;
    gelecekGun: boolean;
  } | null = null;
  if (pings.length === 0) {
    const [sonPing, sofor] = await Promise.all([
      prisma.driverLocationPing.findFirst({
        where: { driverId },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      }),
      prisma.driver.findUnique({
        where: { id: driverId },
        select: { isOnShift: true },
      }),
    ]);
    tani = {
      hicKayitYok: sonPing == null,
      sonKayit: sonPing?.recordedAt.toISOString() ?? null,
      mesaide: sofor?.isOnShift ?? false,
      gelecekGun: start.getTime() > Date.now(),
    };
  }

  const points = downsample(
    pings.map((p) => [p.lat, p.lng] as [number, number]),
    500,
  );
  const stopRows = stops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
    address: s.address,
    startedAt: s.startedAt,
    durationMin: Math.round((s.durationSec ?? 0) / 60),
  }));
  const totalStopMin = stopRows.reduce((a, s) => a + s.durationMin, 0);

  return NextResponse.json({
    points,
    stops: stopRows,
    tani,
    summary: {
      pingCount: pings.length,
      stopCount: stopRows.length,
      totalStopMin,
    },
  });
}
