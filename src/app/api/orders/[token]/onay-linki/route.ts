// ONAY BAĞLANTISINI MÜŞTERİYE YENİDEN GÖNDER (2026-08-07 gecesi).
//
// NEDEN VAR (işletme sahibi: *"halı takip sayfasından kesin fiyat onayı neden
// verilmiyor?"*):
// Kesin fiyat onayı yalnız MÜŞTERİYE ÖZEL uzun bağlantıyla (ya da sipariş
// sahibinin hesabıyla) yapılabiliyor. Sebebi güvenlik: kısa takip kodunu
// (A45VJM) halıcı ve şoför de görüyor; kısa kod yetseydi halıcı müşterinin
// dijital onayını TAKLİT edebilirdi ve o onay hukuken delil olmaktan çıkardı
// (Mesafeli Söz. Yön. md.15/1-h). Bu kural halıcıyı da korur.
//
// AMA eksik olan şuydu: kısa kodla giren müşteri bir paragrafın önünde
// TIKANIYORDU ("size gönderilen bağlantıyı açın" — hangi bağlantı, nerede?).
// Bu uç o çıkmazı tek dokunuşa çeviriyor: bağlantı, siparişte KAYITLI olan
// numaraya/e-postaya yeniden gönderilir.
//
// 🔒 SIZINTI YOK: bağlantı isteyene değil, siparişin kendi iletişim bilgisine
// gider. Kısa kodu bilen halıcı bu ucu çağırsa bile bağlantı yine MÜŞTERİYE
// gider — halıcının eline geçmez.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = rateLimit(`onay-linki:${clientIp(req)}`, 5, 10 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { token } = await params;
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      quotedPrice: true,
      priceApprovedAt: true,
      business: { select: { name: true, ownerId: true, isDemo: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (order.business?.isDemo)
    return NextResponse.json(
      { error: "Demo siparişte gerçek mesaj gönderilmez." },
      { status: 400 },
    );
  if (order.status !== "PICKED_UP" || order.quotedPrice == null)
    return NextResponse.json(
      { error: "Bu siparişte onay bekleyen bir kesin fiyat yok." },
      { status: 409 },
    );
  if (order.priceApprovedAt)
    return NextResponse.json({ ok: true, zatenOnayli: true });

  // Sipariş başına fren: arka arkaya basılınca müşteriye mesaj yağmasın
  // (her WhatsApp mesajı Meta'da ücretli).
  const rlSiparis = rateLimit(`onay-linki-sip:${order.id}`, 3, 10 * 60 * 1000);
  if (!rlSiparis.ok) return tooMany(rlSiparis.retryAfterSec);

  const { waFiyatOnayi, waGonderVeKaydet } = await import("@/lib/whatsapp");
  const { bildirMusteriyeEposta } = await import("@/lib/orderNotify");

  void waGonderVeKaydet({
    orderId: order.id,
    status: "PICKED_UP",
    ownerUserId: order.business?.ownerId,
    etiket: "Onay bağlantısı (yeniden)",
    metin: "Kesin fiyat onay bağlantısı yeniden gönderildi.",
    gonder: () =>
      waFiyatOnayi(
        order.customerPhone,
        order.customerName,
        order.business?.name ?? "İşletme",
        order.code ?? "",
        order.trackingToken,
      ),
  });
  await bildirMusteriyeEposta(order.id, "fiyat-onayi").catch((e) =>
    console.error("[onay-linki] e-posta hatası:", e),
  );

  // Nereye gittiğini SÖYLE ama numarayı/e-postayı AÇIKÇA yazma: bu sayfayı
  // halıcı da açabiliyor, müşterinin iletişim bilgisi orada görünmemeli.
  return NextResponse.json({
    ok: true,
    kanal: order.customerEmail ? "whatsapp+eposta" : "whatsapp",
  });
}
