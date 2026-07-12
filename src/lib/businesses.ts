import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { activeSubscriptionWhere } from "@/lib/subscription";
import { trNowParts } from "@/lib/time";
import type { BadgeType, PricingUnit } from "@prisma/client";

export type BusinessFilter = {
  city?: string;
  district?: string;
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
  minPrice: number | null;
  distanceKm: number | null;
  isNew: boolean;
  isOpenNow: boolean;
  isPaused: boolean; // tatil modu — listede kalır ama "sipariş almıyor" rozeti
  rejectRate: number;
  totalOrders: number;
  coverUrl: string | null;
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

// Sıralama puanı: yeni halıcıya küçük destek, red oranına güvenle-ölçekli ceza
function sortRating(b: BusinessSummary): number {
  const base =
    b.isNew && b.ratingCount === 0
      ? 4.0
      : b.ratingAvg + (b.isNew ? 0.15 : 0);
  return base - b.rejectRate * 1.5 * rejectConfidence(b.totalOrders);
}

type Hours = Record<string, { open: string; close: string } | null>;

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

// Otomatik kazanılan rozetler (veriden) + manuel rozetler (VERIFIED/INSURED)
function deriveBadges(opts: {
  manual: BadgeType[];
  ratingAvg: number;
  ratingCount: number;
  deliveryMaxDays: number | null;
  totalOrders: number;
  rejectRate: number;
}): BadgeType[] {
  const derived: BadgeType[] = [];
  if (opts.deliveryMaxDays != null && opts.deliveryMaxDays <= 2)
    derived.push("FAST_DELIVERY");
  if (opts.ratingCount >= 20 && opts.ratingAvg >= 4.5)
    derived.push("TOP_RATED");
  if (opts.totalOrders >= 5 && opts.rejectRate < 0.15)
    derived.push("FAST_RESPONDER");
  return Array.from(new Set([...opts.manual, ...derived]));
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
  }

  const rows = await prisma.cleanerBusiness.findMany({
    where,
    include: {
      badges: true,
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
    const manual = b.badges
      .map((x) => x.type)
      .filter((t) => t === "VERIFIED" || t === "INSURED");

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
      badges: deriveBadges({
        manual,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        deliveryMaxDays: b.deliveryEstimateMaxDays,
        totalOrders: s?.total ?? 0,
        rejectRate,
      }),
      minPrice: prices.length ? Math.min(...prices) : null,
      distanceKm,
      isNew: Date.now() - b.createdAt.getTime() < NEW_WINDOW_MS,
      isOpenNow: isOpenNow(b.workingHours),
      isPaused: b.pausedUntil != null && b.pausedUntil > new Date(),
      rejectRate,
      totalOrders: s?.total ?? 0,
      coverUrl: b.photos[0]?.url ?? null,
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
      if (sr !== 0) return sr;
      return a.id.localeCompare(b.id); // kararlı tie-breaker (D4)
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
      badges: true,
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
  const manual = b.badges
    .map((x) => x.type)
    .filter((t) => t === "VERIFIED" || t === "INSURED");
  const badges = deriveBadges({
    manual,
    ratingAvg: b.ratingAvg,
    ratingCount: b.ratingCount,
    deliveryMaxDays: b.deliveryEstimateMaxDays,
    totalOrders: s?.total ?? 0,
    rejectRate,
  });

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    address: b.address,
    city: b.city,
    district: b.district,
    phone: b.phone,
    // Tatil modu: geçerli bir duraklatma varsa profil sipariş butonunu kapatır.
    pausedUntil:
      b.pausedUntil && b.pausedUntil > new Date() ? b.pausedUntil : null,
    workingHours: b.workingHours,
    deliveryMinDays: b.deliveryEstimateMinDays,
    deliveryMaxDays: b.deliveryEstimateMaxDays,
    ratingAvg: b.ratingAvg,
    ratingCount: b.ratingCount,
    googleProfileUrl: b.googleProfileUrl,
    badges,
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
