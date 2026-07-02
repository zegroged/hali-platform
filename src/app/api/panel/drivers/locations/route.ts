import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { trDayBoundsUTC } from "@/lib/time";

// Halıcının kendi şoförlerinin canlı konumu + bugünkü rota izi (breadcrumb)
export async function GET() {
  const b = await getCurrentBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { start: startToday } = trDayBoundsUTC(); // bugünün TR gün başı

  const onShiftIds = b.drivers.filter((d) => d.isOnShift).map((d) => d.id);
  const pings = onShiftIds.length
    ? await prisma.driverLocationPing.findMany({
        where: { driverId: { in: onShiftIds }, recordedAt: { gte: startToday } },
        orderBy: { recordedAt: "asc" },
        select: { driverId: true, lat: true, lng: true },
      })
    : [];

  const byDriver = new Map<string, [number, number][]>();
  for (const p of pings) {
    const arr = byDriver.get(p.driverId) ?? [];
    arr.push([p.lat, p.lng]);
    byDriver.set(p.driverId, arr);
  }

  return NextResponse.json({
    drivers: b.drivers.map((d) => ({
      id: d.id,
      name: d.user.name,
      isOnShift: d.isOnShift,
      lat: d.lastLat,
      lng: d.lastLng,
      lastSeenAt: d.lastSeenAt,
      // son ~40 nokta — canlı iz
      recentPath: (byDriver.get(d.id) ?? []).slice(-40),
    })),
  });
}
