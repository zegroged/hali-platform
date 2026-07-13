import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { createOrderWithCode } from "@/lib/ordercode";
import { sendTrackingSms, trackingLink } from "@/lib/sms";
import { subscriptionActive } from "@/lib/subscription";
import { notify } from "@/lib/notify";

const Body = z.object({
  customerName: z.string().min(2, "Müşteri adı en az 2 karakter olmalı.").max(100),
  customerPhone: z.string().min(10, "Telefon 11 hane olmalı.").max(20),
  pickupAddress: z.string().min(3, "Adres en az 3 karakter olmalı.").max(300),
  // Müşteri konumu — opsiyonel (halıcı adresten bulur / haritadan işaretler).
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  approxM2: z
    .number()
    .positive("m² sıfırdan büyük olmalı.")
    .max(100000, "m² en fazla 100.000 olabilir.")
    .optional(),
  note: z.string().max(500, "Not en fazla 500 karakter olabilir.").optional(),
  paymentMethod: z.enum(["CASH", "CARD"]),
  driverId: z.string().max(40).optional(),
});

// Halıcının kendi (dükkâna gelen) müşterisi için manuel sipariş/kayıt oluşturma.
export async function POST(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // "Geçersiz veri" hiçbir şey anlatmıyordu (ör. 123123 m² sessizce reddediliyordu).
    // İlk kuralın kendi mesajını dön ki halıcı NEYİ düzelteceğini görsün.
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Geçersiz veri" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Aboneliği geçerli olmayan halıcı manuel kayıt da oluşturamaz (gelir tutarlılığı).
  if (!subscriptionActive(b.subscription)) {
    return NextResponse.json(
      { error: "Aboneliğiniz aktif değil. Sipariş oluşturulamıyor." },
      { status: 410 },
    );
  }
  // Şoför yoksa manuel kayıt da asılı kalır → engelle.
  if (b.drivers.length === 0) {
    return NextResponse.json(
      { error: "Önce en az bir şoför ekleyin." },
      { status: 409 },
    );
  }

  let driverId: string | undefined;
  if (d.driverId) {
    // Şoför seçildiyse GEÇERLİ olmalı — sessizce başkasına düşürme (C3).
    if (!b.drivers.some((x) => x.id === d.driverId)) {
      return NextResponse.json({ error: "Geçersiz şoför seçimi." }, { status: 400 });
    }
    driverId = d.driverId;
  } else {
    const dr = b.drivers.find((x) => x.isOnShift) ?? b.drivers[0];
    driverId = dr.id;
  }

  const order = await createOrderWithCode((code) =>
    prisma.order.create({
      data: {
        businessId: b.id,
        driverId,
        code,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        pickupAddress: d.pickupAddress,
        pickupLat: d.pickupLat,
        pickupLng: d.pickupLng,
        approxM2: d.approxM2,
        note: d.note,
        // Web'de şimdilik YALNIZ nakit (komisyon/kart ertelendi; app'te geri açılacak).
        paymentMethod: "CASH",
        isManual: true, // SLA bekçisi/24s kurtarma bu kaydı atlasın
        events: { create: { status: "CREATED", note: "Halıcı kaydı oluşturdu" } },
      },
    }),
  );

  // Atanan şoföre uygulama-içi bildirim (halıcı zaten kendisi oluşturdu).
  const assigned = b.drivers.find((x) => x.id === driverId);
  if (assigned) {
    await notify({
      userId: assigned.userId,
      type: "is-atandi",
      title: "Sana yeni iş atandı",
      body: `Kod: ${order.code ?? ""} · ${d.customerName}`,
      href: "/sofor",
    });
  }

  try {
    // Müşteriye giden link UZUN trackingToken (onay/iptal bu linkle yapılır);
    // işletmeye dönen trackingUrl (aşağıda) kısa kod kalır (read-only önizleme).
    await sendTrackingSms(d.customerPhone, d.customerName, order.trackingToken);
  } catch (e) {
    console.error("panel order SMS hatası:", e);
  }

  return NextResponse.json({
    code: order.code,
    trackingUrl: trackingLink(order.code ?? order.trackingToken),
  });
}
