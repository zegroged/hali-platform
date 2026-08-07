// Kesin fiyat onayı (Mesafeli Sözleşmeler Yönetmeliği md.15/1-h): müşteri,
// işletmenin bildirdiği kesin fiyatı takip sayfasından onaylar → ifaya
// (yıkamaya) başlama izni zaman damgalı olarak kayda geçer (ispat platformda).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { getAuthedUser } from "@/lib/auth";
// 🔑 ONAY MANTIĞI TEK KAYNAKTA (2026-08-07 akşam): aynı onay artık WhatsApp
// düğmesinden de gelebiliyor. İki kopya tutmak bu depodaki en pahalı hata
// deseni — bkz. lib/fiyatOnay.ts başlığı.
import { fiyatiOnayla } from "@/lib/fiyatOnay";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Tek seferlik aksiyon — takip polling'inden ayrı, daha sıkı limit.
  const ip = clientIp(req);
  const rl = rateLimit(`approve-price:${ip}`, 10, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { token } = await params;
  // Link (trackingToken) ya da kısa kod ile bulunabilir
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      customerId: true,
      quotedPrice: true,
      priceApprovedAt: true,
      business: { select: { phone: true, ownerId: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  // MÜŞTERİYE ÖZEL KANAL (denetim bulgusu): kesin fiyat onayı yalnız (a) müşteriye
  // SMS/e-posta ile giden UZUN takip bağlantısı (trackingToken) ile YA DA (b) o
  // siparişin sahibi olarak giriş yapmış üye tarafından yapılabilir. Kısa kod
  // işletme + atanan şoförde görünür; tek başına kabul etseydik işletme
  // müşterinin dijital onayını (md.15/1-h ispatı) taklit edebilirdi.
  const viewer = await getAuthedUser();
  const isOwner =
    viewer?.role === "CUSTOMER" &&
    order.customerId != null &&
    order.customerId === viewer.id;
  if (order.trackingToken !== token && !isOwner) {
    return NextResponse.json(
      {
        error:
          "Fiyat onayı için size SMS/e-posta ile gönderilen takip bağlantısını açın (veya siparişi veren hesapla giriş yapın). Kısa takip kodu tek başına bu işlem için kullanılamaz.",
      },
      { status: 403 },
    );
  }
  if (order.quotedPrice == null) {
    return NextResponse.json(
      { error: "Onaylanacak bir kesin fiyat bildirimi bulunmuyor." },
      { status: 409 },
    );
  }

  const r = await fiyatiOnayla(order.id, "takip sayfası");
  if (!r.ok) return NextResponse.json({ error: r.hata }, { status: r.durum });

  return NextResponse.json({ ok: true });
}
