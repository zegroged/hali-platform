import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveOrderPhotoFile } from "@/lib/orderPhoto";
import { rateLimit, clientIp, tooMany } from "@/lib/ratelimit";
import { getAuthedUser } from "@/lib/auth";

// MÜŞTERİNİN SİPARİŞE FOTOĞRAF EKLEMESİ (2026-08-06, isteğe bağlı).
//
// NEDEN: sipariş verirken halının hâlini gösteren bir kare, işletmenin işi
// GÖRMEDEN daha isabetli fiyat/süre tahmini yapmasını sağlıyor; ayrıca hasar
// tartışmasında "ben bunu böyle verdim" kaydı müşteri tarafında da oluşuyor.
// Zorunlu DEĞİL — sipariş akışını hiçbir noktada bloklamaz.
//
// YETKİ: takip jetonu (`trackingToken`) siparişe erişim kanıtıdır — takip
// sayfasının tamamı zaten bu jetonla açılıyor. Üyelik aranmaz: sipariş misafir
// olarak veriliyor.
//
// SINIRLAR (kötüye kullanım yüzeyi jeton bilen herkese açık olduğu için dar):
//  · yalnız işin BAŞINDA (CREATED/ACCEPTED) — halı alındıktan sonra kanıt
//    zinciri şoförün fotoğrafına aittir, müşteri sonradan kare ekleyemez,
//  · sipariş başına en fazla 5 müşteri fotoğrafı,
//  · IP başına saatte 20 istek.
const MAX_MUSTERI_FOTO = 5;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = rateLimit(`order-photo:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const { token } = await params;
  const order = await prisma.order.findFirst({
    where: { OR: [{ trackingToken: token }, { code: token.toUpperCase() }] },
    select: {
      id: true,
      businessId: true,
      status: true,
      trackingToken: true,
      customerId: true,
      photos: { where: { stage: "MUSTERI" }, select: { id: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  // 🔴 KISA KOD TEK BAŞINA YETMEZ (2026-08-09, DENETİM md.15 — canlıda
  // kanıtlanmıştı).
  //
  // Bu uç, "MUSTERI" aşamalı fotoğraf üretmenin TEK yolu; panelden o etiketle
  // fotoğraf yazılamıyor (bilinçli kural, api/panel/orders/[id]/photos).
  // Kısa kod ise halıcının ve atanan şoförün ekranında görünüyor. İkisi bir
  // araya gelince işletme, "müşteri alımdan ÖNCE bu fotoğrafı gönderdi"
  // kaydını kendi eliyle üretebiliyordu — hasar tartışmasında müşterinin
  // aleyhine kullanılabilecek sahte bir kanıt.
  //
  // Kardeş uç approve-price aynı kapıyı 2026-08'de kapatmıştı; burası
  // atlanmıştı. Kural birebir aynı: UZUN takip bağlantısı ya da siparişi
  // veren üyenin kendi oturumu.
  const viewer = await getAuthedUser();
  const isOwner =
    viewer?.role === "CUSTOMER" &&
    order.customerId != null &&
    order.customerId === viewer.id;
  if (order.trackingToken !== token && !isOwner) {
    return NextResponse.json(
      {
        error:
          "Fotoğraf eklemek için size SMS/e-posta ile gönderilen takip bağlantısını açın (veya siparişi veren hesapla giriş yapın). Kısa takip kodu tek başına kullanılamaz.",
      },
      { status: 403 },
    );
  }
  if (order.status !== "CREATED" && order.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error:
          "Fotoğraf yalnız halı alınmadan önce eklenebilir. Sonrasındaki kayıtlar işletmeye aittir.",
      },
      { status: 409 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const kalan = MAX_MUSTERI_FOTO - order.photos.length;
  if (kalan <= 0) {
    return NextResponse.json(
      { error: `En fazla ${MAX_MUSTERI_FOTO} fotoğraf ekleyebilirsin.` },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, kalan);
  if (!files.length) {
    return NextResponse.json({ error: "Dosya yok." }, { status: 400 });
  }

  let eklenen = 0;
  for (const file of files) {
    // Her dosya kendi try/catch'inde: biri bozuksa diğerleri kaybolmasın
    // (panel yükleyicisiyle aynı kural).
    try {
      const url = await saveOrderPhotoFile(
        file,
        order.businessId,
        order.id,
        "MUSTERI",
      );
      if (url) eklenen++;
    } catch (e) {
      console.error("müşteri sipariş fotoğrafı kaydedilemedi:", e);
    }
  }
  if (eklenen === 0) {
    return NextResponse.json(
      { error: "Fotoğraf yüklenemedi (jpg/png/webp, ≤8MB)." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, eklenen });
}
