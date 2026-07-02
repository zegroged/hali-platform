import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Kod enumerasyonu / PII hasadı koruması: IP başına dakikada 60 (canlı takip
  // polling'ine yeter, brute-force'u yavaşlatır). NOT: 6 haneli kod düşük entropili;
  // daha yüksek güvenlik için telefon-son4 doğrulaması eklenebilir.
  const ip = clientIp(req);
  const rl = rateLimit(`track:${ip}`, 60, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { token } = await params;
  // Link (trackingToken) ya da kısa kod ile bulunabilir
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    include: {
      business: { select: { name: true, phone: true } },
      driver: { select: { lastLat: true, lastLng: true, user: { select: { name: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  // Müşteri canlı konumu YALNIZCA şoför teslime çıkınca görür ("siparişi bırakıyorum")
  const showDriver =
    order.status === "OUT_FOR_DELIVERY" &&
    order.driver?.lastLat != null &&
    order.driver?.lastLng != null;

  return NextResponse.json({
    status: order.status,
    rejectReason: order.rejectReason,
    createdAt: order.createdAt,
    customerName: order.customerName,
    pickupAddress: order.pickupAddress,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    priceTotal: order.priceTotal != null ? Number(order.priceTotal) : null,
    paymentMethod: order.paymentMethod,
    business: order.business,
    events: order.events.map((e) => ({
      status: e.status,
      note: e.note,
      at: e.createdAt,
    })),
    driver: showDriver
      ? {
          name: order.driver!.user.name,
          lat: order.driver!.lastLat,
          lng: order.driver!.lastLng,
        }
      : null,
  });
}
