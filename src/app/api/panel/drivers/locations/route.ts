import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPanelBusiness } from "@/lib/panel";
import { trDayBoundsUTC } from "@/lib/time";
import { izHazirla } from "@/lib/konumFiltre";

// Halıcının kendi şoförlerinin canlı konumu + bugünkü rota izi (breadcrumb)
export async function GET() {
  const b = await getPanelBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { start: startToday } = trDayBoundsUTC(); // bugünün TR gün başı

  const onShiftIds = b.drivers.filter((d) => d.isOnShift).map((d) => d.id);
  const pings = onShiftIds.length
    ? await prisma.driverLocationPing.findMany({
        where: { driverId: { in: onShiftIds }, recordedAt: { gte: startToday } },
        orderBy: { recordedAt: "asc" },
        select: { driverId: true, lat: true, lng: true, recordedAt: true },
      })
    : [];

  const byDriver = new Map<string, { lat: number; lng: number; t: number }[]>();
  for (const p of pings) {
    const arr = byDriver.get(p.driverId) ?? [];
    arr.push({ lat: p.lat, lng: p.lng, t: p.recordedAt.getTime() });
    byDriver.set(p.driverId, arr);
  }

  return NextResponse.json({
    drivers: b.drivers.map((d) => {
      // 🔴 2026-08-07 akşam: BURASI SÜZGEÇSİZDİ — canlı harita ham ping'leri
      // çiziyordu. Süzgeç (lib/konumFiltre.ts) 08-06'da yazıldığında yalnız
      // "Rota Geçmişi" ucuna bağlanmış, ASIL şikâyetin geldiği ekran olan
      // Canlı Takip atlanmıştı. Yani "şoför evden çıkmadı, harita yol çizdi"
      // sorunu canlı ekranda AYNEN duruyordu.
      // (DEVIR §"pahalı dersler"/5: tek kaynağın İKİ tüketicisi olabilir.)
      const { cizgi, merkez } = izHazirla(byDriver.get(d.id) ?? []);
      return {
        id: d.id,
        name: d.user.name,
        isOnShift: d.isOnShift,
        // İşaretçi de süzülmüş konumu kullanır: son ping sapmış olsa bile
        // şoför gerçekte durduğu yerde görünür. Bugün hiç ping yoksa
        // (mesai yeni açıldı) son bilinen konuma düşülür.
        lat: merkez ? merkez[0] : d.lastLat,
        lng: merkez ? merkez[1] : d.lastLng,
        lastSeenAt: d.lastSeenAt,
        // son ~40 nokta — canlı iz (süzülmüş)
        recentPath: cizgi.slice(-40),
      };
    }),
  });
}
