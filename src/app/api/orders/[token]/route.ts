import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";
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
      business: { select: { name: true, phone: true, city: true } },
      driver: { select: { lastLat: true, lastLng: true, user: { select: { name: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      photos: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
      review: { select: { rating: true } },
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

  // Değerlendirme için üyelik zorunlu — görüntüleyen giriş yapmış müşteri mi?
  // (UI: üye ise yorum formu, değilse "üye ol/giriş yap" bandı gösterir.)
  const viewer = await getAuthedUser();
  const viewerIsCustomer = viewer?.role === "CUSTOMER";

  // Kurtarma: sipariş reddedildi/iptal edildiyse YA DA 24 saattir yanıtsızsa
  // müşteri çıkmaz sokakta kalmasın — aynı şehirdeki alternatif halıcıları öner.
  // isManual hariç: panel kaydında "işletme yanıt vermedi" bandı anlamsız.
  const waitingLong =
    order.status === "CREATED" &&
    !order.isManual &&
    Date.now() - order.createdAt.getTime() > 24 * 60 * 60 * 1000;
  const needsAlternatives =
    order.status === "REJECTED" || order.status === "CANCELED" || waitingLong;
  let alternatives: {
    id: string;
    name: string;
    district: string;
    ratingAvg: number;
    ratingCount: number;
  }[] = [];
  if (needsAlternatives) {
    try {
      const { activeSubscriptionWhere } = await import("@/lib/subscription");
      alternatives = await prisma.cleanerBusiness.findMany({
        where: {
          id: { not: order.businessId },
          isVisible: true,
          verification: { not: "REJECTED" },
          subscription: activeSubscriptionWhere(),
          city: { equals: order.business.city, mode: "insensitive" },
          // Tatil modundaki işletmeyi önerme — müşteri yine çıkmaza girer.
          OR: [{ pausedUntil: null }, { pausedUntil: { lte: new Date() } }],
        },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
        take: 3,
        select: {
          id: true,
          name: true,
          district: true,
          ratingAvg: true,
          ratingCount: true,
        },
      });
    } catch (e) {
      console.error("takip alternatif önerisi hatası:", e); // öneri süs, akışı bozmasın
    }
  }

  // Savunma derinliği (denetim bulgusu): tam açık adres + kesin GPS yalnız
  // TAHMİN EDİLEMEZ uzun link token'ıyla (trackingToken) erişimde döner. Kısa
  // 6-haneli kodla (enumerable) erişimde bunlar kısılır — kod tahmin eden biri
  // müşterinin ev GPS'ini/tam adresini hasat edemesin. Meşru müşteri SMS/e-posta'
  // daki LİNKe tıklar (tam veri); kodu elle giren yine durumu görür.
  const viaLongToken = order.trackingToken === token;
  const safeAddress = viaLongToken
    ? order.pickupAddress
    : `${order.pickupAddress.split(/[,/]/)[0].slice(0, 24)}…`; // yalnız ilk parça

  // Kesin-fiyat onayı ve iptal yalnız (a) uzun bağlantıyla YA DA (b) siparişi
  // veren üye girişiyle yapılabilir (approve-price/cancel ile aynı kural). Kısa
  // kod işletme/şoförde görünür. İstemci butonları buna göre gösterir/gizler.
  const isOwnerViewer =
    viewerIsCustomer &&
    order.customerId != null &&
    order.customerId === viewer!.id;
  return NextResponse.json({
    status: order.status,
    fullAccess: viaLongToken || isOwnerViewer,
    rejectReason: order.rejectReason,
    createdAt: order.createdAt,
    customerName: order.customerName,
    pickupAddress: safeAddress,
    pickupLat: viaLongToken ? order.pickupLat : null,
    pickupLng: viaLongToken ? order.pickupLng : null,
    priceTotal: order.priceTotal != null ? Number(order.priceTotal) : null,
    // md.15/1-h: işletmenin bildirdiği kesin fiyat + müşterinin onay anı
    quotedPrice: order.quotedPrice != null ? Number(order.quotedPrice) : null,
    priceApprovedAt: order.priceApprovedAt,
    paymentMethod: order.paymentMethod,
    estimatedDays: order.estimatedDays,
    photos: order.photos,
    business: { name: order.business.name, phone: order.business.phone },
    // 24 saattir yanıtsız mı? (takip sayfası "beklemek zorunda değilsin" bandı)
    waitingLong,
    // Red/iptal/uzun bekleme durumunda aynı şehirden alternatif halıcılar.
    alternatives,
    // Teslim sonrası değerlendirme: varsa yıldızı göster, yoksa form çıkar.
    review: order.review,
    // Üyelik zorunlu — UI formu mu, "üye ol" bandını mı göstersin?
    viewerIsCustomer,
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
