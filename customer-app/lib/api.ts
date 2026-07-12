// Backend adresi ORTAMDAN gelir (sabit IP gömme — mağaza derlemesinde kırılır).
// Üretim derlemesi EAS profilinden `EXPO_PUBLIC_API_BASE=https://...` alır
// (eas.json); dev için kabuk: EXPO_PUBLIC_API_BASE=http://192.168.0.11:3000
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://enyakinhaliyikamaservisi.com";

/** Sunucunun Türkçe hata mesajını taşıyan hata — UI olduğu gibi gösterir. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new ApiError(data?.error ?? fallback, res.status);
}

export type Business = {
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
  minPrice: number | null;
  isNew: boolean;
  isOpenNow: boolean;
  isPaused: boolean; // tatil modu — "sipariş almıyor" rozeti
  distanceKm: number | null;
  coverUrl: string | null;
  badges: string[];
};

export type Pricing = {
  label: string;
  unit: string;
  price: number;
  isAddon: boolean;
};
export type Review = {
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
};
export type Photo = {
  url: string;
  isBefore: boolean;
  isAfter: boolean;
  caption: string | null;
};
export type BusinessDetail = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  district: string;
  phone: string;
  workingHours: Record<string, { open: string; close: string } | null> | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  ratingAvg: number;
  ratingCount: number;
  badges: string[];
  pricing: Pricing[];
  photos: Photo[];
  reviews: Review[];
  // Tatil modu: doluysa ve gelecekteyse işletme yeni sipariş almıyor.
  pausedUntil?: string | null;
  googleProfileUrl?: string | null;
};

export type Tracking = {
  status: string;
  rejectReason: string | null;
  createdAt: string;
  customerName: string;
  business: { name: string; phone: string };
  events: { status: string; note: string | null; at: string }[];
  driver: { name: string; lat: number; lng: number } | null;
  priceTotal: number | null;
  paymentMethod: string;
  // md.15/1-h: işletmenin bildirdiği kesin fiyat + müşterinin onay anı.
  // quotedPrice dolu ve priceApprovedAt boşsa müşteriden ONAY beklenir.
  quotedPrice: number | null;
  priceApprovedAt: string | null;
  estimatedDays: number | null;
  photos: { id: string; url: string }[];
  // SLA/kurtarma: 24 saattir yanıtsız mı + aynı şehirden alternatif halıcılar
  waitingLong?: boolean;
  alternatives?: {
    id: string;
    name: string;
    district: string;
    ratingAvg: number;
    ratingCount: number;
  }[];
};

export async function getBusinesses(coords?: {
  lat: number;
  lng: number;
}): Promise<Business[]> {
  // Koordinat ~110 m'ye yuvarlanır: sıralama için fazlası gereksiz, kesin
  // konum URL/erişim loglarında kalıcılaşmasın (gizlilik beyanıyla tutarlı).
  const q = coords
    ? `?lat=${coords.lat.toFixed(3)}&lng=${coords.lng.toFixed(3)}`
    : "";
  const res = await fetch(`${API_BASE}/api/businesses${q}`);
  if (!res.ok) throw new ApiError("Liste alınamadı.", res.status);
  return (await res.json()).businesses ?? [];
}

export async function getBusiness(id: string): Promise<BusinessDetail | null> {
  const res = await fetch(`${API_BASE}/api/businesses/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export type OrderBody = {
  businessId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  approxM2?: number;
  note?: string;
  paymentMethod: "CASH" | "CARD";
  // Mesafeli Sözleşmeler Yön. md.7: ön bilgilendirme TEYİDİ — sunucu bunsuz
  // siparişi reddeder; UI onay kutusu işaretlenmeden göndermemeli.
  consent: true;
};

export async function createOrder(
  body: OrderBody,
): Promise<{ trackingToken: string; code: string | null }> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Sunucunun gerçek mesajı gösterilir (tatil modu, şoför yok, abonelik...)
    throw await readError(res, "Sipariş oluşturulamadı.");
  }
  return res.json();
}

/**
 * Takip verisi. null = sipariş GERÇEKTEN yok (404). Geçici hatalar (429/5xx)
 * ApiError fırlatır — polling'de mevcut görünüm korunmalı, "bulunamadı"
 * gösterilmemeli (rate limit/deploy anında ekran silinmesin).
 */
export async function getTracking(
  codeOrToken: string,
): Promise<Tracking | null> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, "Takip bilgisi alınamadı.");
  return res.json();
}

/** md.15/1-h: kesin fiyata müşteri onayı — yıkama bu onayla başlar. */
export async function approvePrice(codeOrToken: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}/approve-price`,
    { method: "POST" },
  );
  if (!res.ok) throw await readError(res, "Onay gönderilemedi.");
}

// Sunucudaki CANCEL_REASONS ile birebir aynı tutulmalı.
export const CANCEL_REASONS = [
  "Vazgeçtim",
  "Fiyat beklentimi aştı",
  "Başka işletmeyle anlaştım",
  "Zamanlama uygun değil",
  "Diğer",
] as const;

/** Platform üzerinden iptal/cayma — yalnız halı alınmadan (CREATED/ACCEPTED). */
export async function cancelOrder(
  codeOrToken: string,
  reason: string,
  note?: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note }),
    },
  );
  if (!res.ok) throw await readError(res, "İptal edilemedi.");
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : API_BASE + path;
}
