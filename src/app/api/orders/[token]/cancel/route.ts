// Platform üzerinden cayma/iptal bildirimi (Mesafeli Sözleşmeler Yönetmeliği
// md.11/5): tüketici cayma beyanını platform ÜZERİNDEN gönderir; bildirim
// zaman damgalı kayda geçer, işletmeye SMS ile derhal iletilir ve tüketiciye
// hem ekranda hem SMS ile teyit verilir.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { sendSms } from "@/lib/sms";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Tek seferlik aksiyon — takip polling'inden ayrı, daha sıkı limit.
  const ip = clientIp(req);
  const rl = rateLimit(`order-cancel:${ip}`, 10, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { token } = await params;
  // Link (trackingToken) ya da kısa kod ile bulunabilir
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      status: true,
      customerPhone: true,
      priceApprovedAt: true,
      business: { select: { phone: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  // CAS: yalnız yıkama başlamamış (CREATED/ACCEPTED/PICKED_UP) ve kesin fiyat
  // onaylanmamışken iptal edilebilir; onay sonrası md.15/1-h istisnası uygulanır.
  const canceled = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["CREATED", "ACCEPTED", "PICKED_UP"] },
      priceApprovedAt: null,
    },
    data: { status: "CANCELED" },
  });
  if (canceled.count === 0) {
    // Çift tık: zaten iptal edilmişse idempotent başarı döndür.
    if (order.status === "CANCELED") return NextResponse.json({ ok: true });
    return NextResponse.json(
      {
        error:
          "Bu aşamada platform üzerinden iptal edilemiyor. Lütfen işletmeyi arayın.",
      },
      { status: 409 },
    );
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status: "CANCELED",
      note: "Müşteri platform üzerinden cayma/iptal bildirdi",
    },
  });

  const ref = order.code ?? order.trackingToken;
  // SMS hataları iptali bozmasın (durum zaten yazıldı) — md.11/5'in "derhal
  // iletme + teyit" bacağı: işletmeye bildirim, müşteriye teyit.
  try {
    await sendSms(
      order.business.phone,
      `${ref} kodlu siparis musteri tarafindan iptal edildi.`,
    );
  } catch (e) {
    console.error("cancel işletme SMS hatası:", e);
  }
  try {
    await sendSms(
      order.customerPhone,
      `Cayma/iptal bildiriminiz isletmeye iletildi. Siparis kodu: ${ref}`,
    );
  } catch (e) {
    console.error("cancel müşteri teyit SMS hatası:", e);
  }

  return NextResponse.json({ ok: true });
}
