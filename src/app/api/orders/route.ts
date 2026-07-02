import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendTrackingSms } from "@/lib/sms";
import { createOrderWithCode } from "@/lib/ordercode";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { subscriptionActive } from "@/lib/subscription";

const Body = z.object({
  businessId: z.string().min(1).max(40),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(10).max(20),
  pickupAddress: z.string().min(5).max(300),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  approxM2: z.number().positive().max(100000).optional(),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(["CASH", "CARD"]),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const d = parsed.data;

  // SMS bombing / spam koruması: kimlik doğrulamasız uç → IP + telefon limiti.
  const ip = clientIp(req);
  const ipRl = rateLimit(`order:ip:${ip}`, 8, 60 * 60 * 1000); // 8/saat
  if (!ipRl.ok) return tooMany(ipRl.retryAfterSec);
  const phoneRl = rateLimit(`order:phone:${d.customerPhone}`, 5, 24 * 60 * 60 * 1000); // 5/gün
  if (!phoneRl.ok) return tooMany(phoneRl.retryAfterSec);

  const business = await prisma.cleanerBusiness.findFirst({
    where: { id: d.businessId, isVisible: true, verification: "VERIFIED" },
    select: {
      id: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    },
  });
  if (!business) {
    return NextResponse.json({ error: "Halıcı bulunamadı" }, { status: 404 });
  }
  // Aktif/geçerli-trial aboneliği olmayan halıcı sipariş ALAMAZ (gelir modeli).
  if (!subscriptionActive(business.subscription)) {
    return NextResponse.json(
      { error: "Bu halıcı şu anda sipariş almıyor." },
      { status: 410 },
    );
  }

  const session = await getSessionUser();

  // Otomatik atama: işi halıcının kendi şoförüne düşür (mesaideki öncelikli)
  const driver = await prisma.driver.findFirst({
    where: { businessId: d.businessId },
    orderBy: [{ isOnShift: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  // Şoförü olmayan işletme sipariş alamaz → sipariş "CREATED"da asılı kalmasın (A5).
  if (!driver) {
    return NextResponse.json(
      { error: "Bu halıcının şu anda uygun şoförü yok, sipariş alınamıyor." },
      { status: 409 },
    );
  }

  const order = await createOrderWithCode((code) =>
    prisma.order.create({
      data: {
        businessId: d.businessId,
        driverId: driver?.id,
        code,
        customerId: session?.role === "CUSTOMER" ? session.id : undefined,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        pickupAddress: d.pickupAddress,
        pickupLat: d.pickupLat,
        pickupLng: d.pickupLng,
        approxM2: d.approxM2,
        note: d.note,
        // Web'de şimdilik YALNIZ nakit (komisyon/kart ertelendi; app'te geri açılacak).
        paymentMethod: "CASH",
        events: { create: { status: "CREATED", note: "Talep oluşturuldu" } },
      },
    }),
  );

  // SMS hatası sipariş oluşturmayı bozmasın (sipariş zaten kaydedildi).
  try {
    await sendTrackingSms(d.customerPhone, d.customerName, order.code ?? order.trackingToken);
  } catch (e) {
    console.error("order tracking SMS hatası:", e);
  }

  return NextResponse.json({
    trackingToken: order.trackingToken,
    code: order.code,
  });
}
