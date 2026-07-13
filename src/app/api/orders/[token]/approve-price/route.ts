// Kesin fiyat onayı (Mesafeli Sözleşmeler Yönetmeliği md.15/1-h): müşteri,
// işletmenin bildirdiği kesin fiyatı takip sayfasından onaylar → ifaya
// (yıkamaya) başlama izni zaman damgalı olarak kayda geçer (ispat platformda).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { sendSms } from "@/lib/sms";
import { notify } from "@/lib/notify";
import { getAuthedUser } from "@/lib/auth";

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

  // CAS: yalnız PICKED_UP + fiyat bildirilmiş + henüz onaylanmamışken yaz —
  // çift tık / yarış durumunda ikinci istek koşula takılır.
  const approved = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: "PICKED_UP",
      quotedPrice: { not: null },
      priceApprovedAt: null,
    },
    data: { priceApprovedAt: new Date() },
  });
  if (approved.count === 0) {
    // Çift tık: zaten onaylanmışsa idempotent başarı döndür.
    if (order.priceApprovedAt != null) return NextResponse.json({ ok: true });
    return NextResponse.json(
      { error: "Fiyat onayı şu anda yapılamıyor. Sayfayı yenileyip tekrar deneyin." },
      { status: 409 },
    );
  }

  // İspat kaydındaki tutar, onay ANINDA kilitlenen fiyat olsun (fetch ile CAS
  // arasında işletme fiyatı güncellemiş olabilir) → taze oku.
  const locked = await prisma.order.findUnique({
    where: { id: order.id },
    select: { quotedPrice: true },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      status: "PICKED_UP", // durum değişmez; onay kaydı düşülür
      note: `Müşteri kesin fiyatı onayladı: ${Number(locked?.quotedPrice ?? order.quotedPrice)} TL — yıkamaya başlama izni verildi`,
    },
  });

  // İşletme onayı beklemeden yıkamaya başlayamıyor — panel yenilemesine
  // muhtaç bırakma, haber ver. Uygulama-içi asıl kanal (SMS mock).
  await notify({
    userId: order.business.ownerId,
    type: "fiyat-onay",
    title: "Müşteri kesin fiyatı onayladı",
    body: `${order.code ?? ""} · ${Number(locked?.quotedPrice ?? order.quotedPrice)} TL — yıkamaya başlayabilirsiniz`,
    href: "/panel/siparisler",
  });
  try {
    await sendSms(
      order.business.phone,
      `Musteri kesin fiyati ONAYLADI (${order.code ?? ""}, ${Number(locked?.quotedPrice ?? order.quotedPrice)} TL). Yikamaya baslayabilirsiniz.`,
    );
  } catch (e) {
    console.error("approve-price işletme SMS hatası:", e);
  }

  return NextResponse.json({ ok: true });
}
