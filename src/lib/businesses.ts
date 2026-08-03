import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { publicTaxNumber } from "@/lib/taxId";
import { activeSubscriptionWhere } from "@/lib/subscription";
import { gizliFiltre } from "@/lib/seoCoverage";
import { trNowParts } from "@/lib/time";
import type { BadgeType, PricingUnit } from "@prisma/client";

export type BusinessFilter = {
  city?: string;
  district?: string;
  // Serbest metin araması (şehir VEYA ilçe VEYA işletme adı) — mobil tek arama
  // kutusu için; city/district verilmediğinde kullanılır.
  q?: string;
  lat?: number;
  lng?: number;
  maxPrice?: number;
  minRating?: number;
  openNow?: boolean;
  sort?: "nearest" | "rating" | "fastest";
};

export type BusinessSummary = {
  id: string;
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingCount: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  badges: BadgeType[];
  /** Rozetin NEDEN hak edildiği (hesaplananlarda dolu, elle verilende boş). */
  badgeNotes: Partial<Record<BadgeType, string>>;
  minPrice: number | null;
  distanceKm: number | null;
  isNew: boolean;
  isOpenNow: boolean;
  /** Kapalıysa "Yarın 09:00'da açılır" gibi metin (yoksa null). */
  opensAtLabel: string | null;
  isPaused: boolean; // tatil modu — listede kalır ama "sipariş almıyor" rozeti
  rejectRate: number;
  totalOrders: number;
  coverUrl: string | null;
  logoUrl: string | null;
};

const NEW_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

// Konumlu aramada hizmet yarıçapı: halı kapıdan alınır — 940 km ötedeki
// işletme "en yakın" diye listelenmesin (Kars'ta arayana Konya çıkıyordu).
// 75 km büyükşehirin ucundan ucuna yeter, şehirler arasını eler.
const MAX_SERVICE_DISTANCE_KM = 75;

// Red cezası güveni: 5+ siparişte tam (1.0), az veride hafif → yeni halıcı
// tek redde orantısız cezalanmasın (A10 cold-start).
function rejectConfidence(totalOrders: number): number {
  return Math.min(1, Math.sqrt(totalOrders / 5));
}

// Yorumcu adını herkese açık sayfada maskele (KVKK): "Ayşe Kaya" → "Ayşe K."
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Müşteri";
  const first = parts[0];
  const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : "";
  return first + initial;
}

// Sıralama puanı: red oranına güvenle-ölçekli ceza + eksik profil cezası.
//
// 🔴 DÜZELTİLDİ (2026-08-03): eski hâlde YORUMU OLMAYAN ve YENİ OLMAYAN
// işletme `ratingAvg = 0` ile puanlanıyordu; yeni olan ise 4.0 alıyordu.
// Platformda henüz 0 yorum olduğu için bu, "en son kaydolanlar başa, eski
// işletmeler en sona" demekti — yani ziyaretçinin gördüğü ilk işletmeler
// "iyi olanlar" değil "en yeniler"di. Artık yorumu olmayan herkes aynı NÖTR
// tabandan başlar; ayrım gerçek veriden (yorum, red oranı, profil) gelir.
const NOTR_PUAN = 3.9;
function sortRating(b: BusinessSummary): number {
  const base = b.ratingCount > 0 ? b.ratingAvg : NOTR_PUAN + (b.isNew ? 0.1 : 0);
  // VİTRİN CEZASI: fotoğrafsız veya fiyatsız profil müşteriyi kaçırıyor;
  // eşit koşulda tam profil öne çıksın (kullanıcı kararı: "ilk gösterilenler
  // güzel olmalı").
  const eksikVitrin = (b.coverUrl ? 0 : 0.25) + (b.minPrice != null ? 0 : 0.15);
  return base - eksikVitrin - b.rejectRate * 1.5 * rejectConfidence(b.totalOrders);
}

// ADİL SIRA (2026-08-03): konum yoksa ve puanlar eşitse liste her zaman aynı
// sırayla açılıyordu — hep aynı işletmeler ilk üçte kalıyordu. Saatlik değişen
// bir tohumla eşit puanlılar arasında sıra döner; sayfalama kararlı kalsın
// diye tohum SAAT bazlıdır (aynı saatte aynı sıra).
function adilTohum(id: string): number {
  const saat = Math.floor(Date.now() / (60 * 60 * 1000));
  let h = saat;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 1000;
}

type Hours = Record<string, { open: string; close: string } | null>;

// KAPALIYKEN "ne zaman açılır" (2026-07-26 tasarım düzeltmesi): kartlarda
// yalnız "Kapalı" yazınca müşteri "burada kimse çalışmıyor" hissediyordu.
// Örnek çıktılar: "09:00'da açılır", "Yarın 09:00'da açılır", "Pzt 09:00'da açılır".
const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
function nextOpenLabel(wh: unknown): string | null {
  if (!wh || typeof wh !== "object") return null;
  const map = wh as Hours;
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const { minutes: cur, day: dow } = trNowParts();
  for (let i = 0; i < 7; i++) {
    const gunIdx = (dow + i) % 7;
    const d = map[keys[gunIdx]];
    if (!d || !d.open || !d.close) continue;
    const [oh, om] = d.open.split(":").map(Number);
    const acilis = oh * 60 + om;
    if (i === 0 && cur >= acilis) continue; // bugünkü açılış geçmiş
    if (i === 0) return `${d.open}'da açılır`;
    if (i === 1) return `Yarın ${d.open}'da açılır`;
    return `${GUN_KISA[gunIdx]} ${d.open}'da açılır`;
  }
  return null;
}

function isOpenNow(wh: unknown): boolean {
  if (!wh || typeof wh !== "object") return false;
  const map = wh as Hours;
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  // TR saatiyle hesapla (sunucu UTC olsa da) — yoksa açık/kapalı 3 saat kayar.
  const { minutes: cur, day: dow } = trNowParts();
  const day = map[keys[dow]];
  if (!day || !day.open || !day.close) return false;
  const [oh, om] = day.open.split(":").map(Number);
  const [ch, cm] = day.close.split(":").map(Number);
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

// ROZETLER ARTIK OKUMA ANINDA TÜRETİLMİYOR (2026-08-03, "hak edilen rozet").
//
// Eski türetim ölçtüğünü sanıyordu ama ölçmüyordu: "Hızlı Teslim" işletmenin
// PROFİLİNE YAZDIĞI tahmini süreye bakıyordu (kendi beyanı), "Çok Tercih
// Edilen" 20 yorum istiyordu (platformda 0 yorum var), "Güvenilir" ise yalnız
// red oranına bakıyordu. Artık dördü de gece GERÇEK veriden hesaplanıp
// gerekçesiyle birlikte Badge tablosuna yazılıyor (bkz. lib/badgeCompute.ts);
// burada yalnız OKUNUR. Elle verilen VERIFIED de aynı tablodadır.
function rozetleriOku(
  kayitlar: { type: BadgeType; note: string | null }[],
): { badges: BadgeType[]; badgeNotes: Partial<Record<BadgeType, string>> } {
  const badges: BadgeType[] = [];
  const badgeNotes: Partial<Record<BadgeType, string>> = {};
  for (const k of kayitlar) {
    badges.push(k.type);
    if (k.note) badgeNotes[k.type] = k.note;
  }
  return { badges, badgeNotes };
}

async function orderStats(
  ids: string[],
): Promise<Map<string, { total: number; rejected: number }>> {
  const stat = new Map<string, { total: number; rejected: number }>();
  if (!ids.length) return stat;
  const grouped = await prisma.order.groupBy({
    by: ["businessId", "status"],
    where: { businessId: { in: ids } },
    _count: true,
  });
  for (const g of grouped) {
    const s = stat.get(g.businessId) ?? { total: 0, rejected: 0 };
    s.total += g._count;
    if (g.status === "REJECTED") s.rejected += g._count;
    stat.set(g.businessId, s);
  }
  return stat;
}

export async function getBusinesses(
  filter: BusinessFilter,
): Promise<BusinessSummary[]> {
  const where: Record<string, unknown> = {
    isVisible: true,
    // Otomatik yayın: admin onayı şart değil; yalnız REJECTED (yayından
    // düşürülmüş) hariç. "Doğrulanmış" rozeti ayrı bir güven işareti.
    verification: { not: "REJECTED" },
    // Yalnız aktif abonelikli (ödemesi alınmış) halıcılar keşifte görünür.
    subscription: activeSubscriptionWhere(),
    // TEST/DEMO KAYDI KEŞİFTEN DE ÇIKAR (2026-07-29). 27'sinde bu işletmeler
    // yalnız Google'a kapatılmıştı (sitemap + noindex); sitenin KENDİ
    // listelerinde durmaya devam ediyorlardı. "Deneme Halı Yıkama (Test)"
    // adlı kayıt canlıda Kadıköy'de herkese görünüyordu — siteye giren
    // ziyaretçide güveni tek başına sıfırlayan bir ayrıntı. Profil adresi
    // (/halici/<id>) hâlâ AÇIK: Play incelemesindeki demo şoför akışı ve
    // doğrudan bağlantı çalışmaya devam etsin diye; yalnız listelerde ve
    // aramada yoklar.
    ...gizliFiltre(),
  };
  if (filter.city && filter.district) {
    // İlçe sayfaları: il+ilçe ÇİFTİ eşleşmeli ("Merkez" gibi ilçe adları
    // onlarca ilde var — tek başına ilçe eşleşmesi yanlış ile taşar).
    // İşletmenin kendi konumu VEYA hizmet bölgesi sayılır.
    const cityEq = { equals: filter.city, mode: "insensitive" as const };
    const districtEq = {
      equals: filter.district,
      mode: "insensitive" as const,
    };
    where.OR = [
      { AND: [{ city: cityEq }, { district: districtEq }] },
      { serviceAreas: { some: { city: cityEq, district: districtEq } } },
    ];
  } else if (filter.district) {
    // İlçe adıyla arama: işletmenin kendi ilçesi VEYA hizmet bölgesi;
    // harf-duyarsız (arama kutusundan küçük harfle gelebilir).
    where.OR = [
      { district: { equals: filter.district, mode: "insensitive" } },
      {
        serviceAreas: {
          some: { district: { equals: filter.district, mode: "insensitive" } },
        },
      },
    ];
  } else if (filter.city) {
    // Şehir sayfaları: işletmenin kendi ili VEYA hizmet bölgesi eşleşsin;
    // serbest metin girildiği için büyük/küçük harf duyarsız karşılaştır.
    where.OR = [
      { city: { equals: filter.city, mode: "insensitive" } },
      {
        serviceAreas: {
          some: { city: { equals: filter.city, mode: "insensitive" } },
        },
      },
    ];
  } else if (filter.q) {
    // Serbest metin (mobil tek kutu): il VEYA ilçe (tam, harf-duyarsız) ya da
    // işletme adı (içerir). Kullanıcı "Konya" ya da "Kadıköy" ya da isim yazabilir.
    const eq = { equals: filter.q, mode: "insensitive" as const };
    where.OR = [
      { city: eq },
      { district: eq },
      { name: { contains: filter.q, mode: "insensitive" } },
      { serviceAreas: { some: { OR: [{ city: eq }, { district: eq }] } } },
    ];
  }

  const rows = await prisma.cleanerBusiness.findMany({
    where,
    include: {
      badges: { select: { type: true, note: true } },
      pricing: { where: { isAddon: false } },
      photos: { orderBy: { isAfter: "desc" }, take: 1 },
    },
  });

  const stat = await orderStats(rows.map((r) => r.id));

  let list: BusinessSummary[] = rows.map((b) => {
    const distanceKm =
      filter.lat != null && filter.lng != null
        ? haversineKm(filter.lat, filter.lng, b.lat, b.lng)
        : null;
    const prices = b.pricing.map((p) => Number(p.price));
    const s = stat.get(b.id);
    const rejectRate = s && s.total > 0 ? s.rejected / s.total : 0;
    const { badges: rozetler, badgeNotes } = rozetleriOku(b.badges);

    return {
      id: b.id,
      name: b.name,
      city: b.city,
      district: b.district,
      lat: b.lat,
      lng: b.lng,
      ratingAvg: b.ratingAvg,
      ratingCount: b.ratingCount,
      deliveryMinDays: b.deliveryEstimateMinDays,
      deliveryMaxDays: b.deliveryEstimateMaxDays,
      badges: rozetler,
      badgeNotes,
      minPrice: prices.length ? Math.min(...prices) : null,
      distanceKm,
      isNew: Date.now() - b.createdAt.getTime() < NEW_WINDOW_MS,
      isOpenNow: isOpenNow(b.workingHours),
      opensAtLabel: isOpenNow(b.workingHours) ? null : nextOpenLabel(b.workingHours),
      isPaused: b.pausedUntil != null && b.pausedUntil > new Date(),
      rejectRate,
      totalOrders: s?.total ?? 0,
      coverUrl: b.photos[0]?.url ?? null,
      logoUrl: b.logoUrl,
    };
  });

  // Konumlu aramada hizmet yarıçapı dışını ele (bkz MAX_SERVICE_DISTANCE_KM).
  if (filter.lat != null && filter.lng != null) {
    list = list.filter(
      (b) => b.distanceKm != null && b.distanceKm <= MAX_SERVICE_DISTANCE_KM,
    );
  }

  // Filtreler
  if (filter.maxPrice != null) {
    list = list.filter(
      (b) => b.minPrice != null && b.minPrice <= filter.maxPrice!,
    );
  }
  if (filter.minRating != null) {
    list = list.filter((b) => b.ratingAvg >= filter.minRating!);
  }
  if (filter.openNow) {
    list = list.filter((b) => b.isOpenNow);
  }

  // Sıralama
  const sort = filter.sort ?? "nearest";
  if (sort === "rating") {
    list.sort((a, b) => sortRating(b) - sortRating(a));
  } else if (sort === "fastest") {
    list.sort(
      (a, b) =>
        (a.deliveryMaxDays ?? 99) - (b.deliveryMaxDays ?? 99) ||
        sortRating(b) - sortRating(a),
    );
  } else {
    // en yakın: yeni halıcıya destek, red oranına güvenle-ölçekli mesafe cezası
    list.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        const ea =
          a.distanceKm * (a.isNew ? 0.9 : 1) *
          (1 + a.rejectRate * rejectConfidence(a.totalOrders));
        const eb =
          b.distanceKm * (b.isNew ? 0.9 : 1) *
          (1 + b.rejectRate * rejectConfidence(b.totalOrders));
        if (Math.abs(ea - eb) > 0.05) return ea - eb;
      }
      const sr = sortRating(b) - sortRating(a);
      if (Math.abs(sr) > 0.001) return sr;
      // Eşit puanda saatlik dönen adil sıra (hep aynı işletme öne çıkmasın).
      return adilTohum(a.id) - adilTohum(b.id);
    });
  }

  return list;
}

export type RecentReview = {
  rating: number;
  comment: string;
  customerName: string; // maskelenmiş
  businessId: string;
  businessName: string;
  district: string;
  createdAt: string;
};

/**
 * Son yorumlar vitrini (ana sayfa + şehir sayfaları): yalnız yayındaki
 * işletmelerin YORUMLU değerlendirmeleri, adlar maskeli (KVKK).
 */
export async function getRecentReviews(
  city?: string,
  take = 6,
): Promise<RecentReview[]> {
  const rows = await prisma.review.findMany({
    where: {
      comment: { not: null },
      business: {
        isVisible: true,
        verification: { not: "REJECTED" },
        subscription: activeSubscriptionWhere(),
        // DEMO işletmenin uydurma yorumu ana sayfada gerçek yorum gibi
        // görünmesin (2026-07-30) — vitrin güveni tek satırla yıkılır.
        ...gizliFiltre(),
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      business: { select: { id: true, name: true, district: true } },
      customer: { select: { name: true } },
      order: { select: { customerName: true } },
    },
  });
  return rows
    .filter((r) => r.comment && r.comment.trim().length > 0)
    .map((r) => ({
      rating: r.rating,
      comment: r.comment!,
      customerName: maskName(r.customer?.name ?? r.order.customerName),
      businessId: r.business.id,
      businessName: r.business.name,
      district: r.business.district,
      createdAt: r.createdAt.toISOString(),
    }));
}

export type PricingRow = {
  label: string;
  unit: PricingUnit;
  price: number;
  isAddon: boolean;
};

export async function getBusinessById(id: string) {
  const b = await prisma.cleanerBusiness.findFirst({
    where: { id, isVisible: true, verification: { not: "REJECTED" } },
    include: {
      badges: { select: { type: true, note: true } },
      pricing: true,
      photos: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          customer: { select: { name: true } },
          // Misafir yorumcu: ad siparişten gelir (maskelenerek gösterilir).
          order: { select: { customerName: true } },
        },
      },
    },
  });
  if (!b) return null;

  const stat = await orderStats([b.id]);
  const s = stat.get(b.id);
  const rejectRate = s && s.total > 0 ? s.rejected / s.total : 0;
  const { badges, badgeNotes } = rozetleriOku(b.badges);

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    address: b.address,
    city: b.city,
    district: b.district,
    phone: b.phone,
    gsmPhone2: b.gsmPhone2,
    landlinePhone: b.landlinePhone,
    // Müşteriye YALNIZ 10 haneli VKN (tüzel kişi) gösterilir; 11 haneli TCKN
    // kişisel veridir (KVKK) → publicTaxNumber null'lar.
    taxNumber: publicTaxNumber(b.taxNumber),
    // Tatil modu: geçerli bir duraklatma varsa profil sipariş butonunu kapatır.
    pausedUntil:
      b.pausedUntil && b.pausedUntil > new Date() ? b.pausedUntil : null,
    workingHours: b.workingHours,
    deliveryMinDays: b.deliveryEstimateMinDays,
    deliveryMaxDays: b.deliveryEstimateMaxDays,
    ratingAvg: b.ratingAvg,
    ratingCount: b.ratingCount,
    googleProfileUrl: b.googleProfileUrl,
    logoUrl: b.logoUrl,
    badges,
    badgeNotes,
    pricing: b.pricing.map((p) => ({
      label: p.label,
      unit: p.unit,
      price: Number(p.price),
      isAddon: p.isAddon,
    })) as PricingRow[],
    photos: b.photos.map((p) => ({
      url: p.url,
      isBefore: p.isBefore,
      isAfter: p.isAfter,
      caption: p.caption,
    })),
    reviews: b.reviews.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      customerName: maskName(r.customer?.name ?? r.order.customerName),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
